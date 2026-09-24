import type { Order, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { audit, type Actor } from "@/lib/audit";
import { ACTIVE_STATUSES, type OrderSource, type OrderStatus } from "@/lib/constants";
import { localDateKey } from "@/lib/time";
import { randomToken } from "@/lib/tokens";
import { grantConsent, upsertCustomer } from "../customers/customerService";
import { DomainError } from "../errors";
import { emit } from "../events";
import { notificationService, type NotificationService } from "../notifications/NotificationService";
import { canTransition, TIMESTAMP_FIELD } from "./transitions";

export type Ctx = {
  businessId: string;
  actor: Actor;
  ip?: string;
  db?: PrismaClient;
  notifications?: NotificationService;
};

export type CreateOrderInput = {
  orderNumber?: string | null;
  externalOrderId?: string | null;
  phone?: string | null;
  customerName?: string | null;
  source: OrderSource;
  status?: "NEW" | "PREPARING" | "READY";
  notify?: boolean;
  consent: { notification: boolean; marketing: boolean; source: string };
};

/**
 * Registra un pedido/turno. Digiturno solo necesita número + celular:
 * nada de productos, precios ni pagos (eso vive en el sistema del negocio).
 * Si llega con external_order_id repetido del mismo origen, devuelve el existente (idempotente).
 */
export async function createOrder(ctx: Ctx, input: CreateOrderInput): Promise<{ order: Order; created: boolean }> {
  const db = ctx.db ?? defaultPrisma;
  const business = await db.business.findUnique({ where: { id: ctx.businessId } });
  if (!business) throw new DomainError("NOT_FOUND", "Negocio no encontrado");

  const externalOrderId = input.externalOrderId?.trim() || null;
  if (externalOrderId) {
    const existing = await db.order.findUnique({
      where: { businessId_source_externalOrderId: { businessId: business.id, source: input.source, externalOrderId } },
    });
    if (existing) return { order: existing, created: false };
  }

  const notify = input.notify ?? true;
  const phone = input.phone?.trim() || null;
  if (!phone && notify && business.requirePhone) {
    throw new DomainError("PHONE_REQUIRED", "El número de celular es obligatorio para avisar al cliente");
  }

  const status = input.status ?? "NEW";
  const now = new Date();

  const order = await db.$transaction(async (tx) => {
    // Número visible del pedido
    let orderNumber: string;
    if (business.numberingMode === "AUTO" && input.source === "MANUAL") {
      const today = localDateKey(now, business.timezone);
      const reset = business.dailyReset && business.orderCounterDate !== today;
      const updated = await tx.business.update({
        where: { id: business.id },
        data: reset ? { orderCounter: 1, orderCounterDate: today } : { orderCounter: { increment: 1 }, orderCounterDate: today },
      });
      orderNumber = business.orderPrefix + updated.orderCounter;
    } else {
      const raw = (input.orderNumber?.trim() || externalOrderId || "").replace(/^#/, "");
      if (!raw) throw new DomainError("VALIDATION", "El número de pedido es obligatorio");
      orderNumber = raw.startsWith(business.orderPrefix) ? raw : business.orderPrefix + raw;
    }

    const duplicate = await tx.order.findFirst({
      where: { businessId: business.id, orderNumber, status: { in: ACTIVE_STATUSES } },
      select: { id: true },
    });
    if (duplicate) throw new DomainError("DUPLICATE_ACTIVE_ORDER", `Ya hay un pedido #${orderNumber} en curso`);

    let customerId: string | null = null;
    if (phone) {
      const customer = await upsertCustomer(tx, business.id, phone, business.country, input.customerName);
      customerId = customer.id;
      const { changed, consent } = await grantConsent(tx, {
        businessId: business.id,
        customerId,
        notification: input.consent.notification,
        marketing: input.consent.marketing,
        source: input.consent.source,
      });
      if (changed) {
        await tx.auditLog.create({
          data: {
            businessId: business.id,
            actor: ctx.actor,
            action: "consent.granted",
            entityType: "customer",
            entityId: customerId,
            ip: ctx.ip,
            metadata: JSON.stringify({
              notificationConsent: consent.notificationConsent,
              marketingConsent: consent.marketingConsent,
              consentSource: consent.consentSource,
            }),
          },
        });
      }
    }

    return tx.order.create({
      data: {
        businessId: business.id,
        customerId,
        orderNumber,
        externalOrderId,
        source: input.source,
        status,
        notify: notify && Boolean(customerId) && input.consent.notification,
        trackingToken: randomToken(18),
        createdAt: now,
        preparingAt: status === "PREPARING" ? now : null,
        readyAt: status === "READY" ? now : null,
      },
    });
  });

  await audit({
    businessId: business.id,
    actor: ctx.actor,
    action: "order.created",
    entityType: "order",
    entityId: order.id,
    ip: ctx.ip,
    metadata: { orderNumber: order.orderNumber, source: order.source, status },
  });
  emit("order.created", { businessId: business.id, orderId: order.id, source: order.source });

  if (status === "READY") await onReady(ctx, order.id);
  return { order, created: true };
}

/**
 * Cambia el estado de un pedido. Siempre filtrado por businessId:
 * un negocio nunca puede tocar pedidos de otro.
 */
export async function changeOrderStatus(ctx: Ctx, orderId: string, to: OrderStatus): Promise<Order> {
  const db = ctx.db ?? defaultPrisma;
  const order = await db.order.findFirst({ where: { id: orderId, businessId: ctx.businessId } });
  if (!order) throw new DomainError("NOT_FOUND", "Pedido no encontrado");

  const from = order.status as OrderStatus;
  if (from === to) return order;
  if (!canTransition(from, to)) {
    throw new DomainError("INVALID_TRANSITION", `No se puede pasar de ${from} a ${to}`);
  }

  const now = new Date();
  const field = TIMESTAMP_FIELD[to];
  // Condición sobre el estado actual para evitar carreras (dos clics simultáneos)
  const { count } = await db.order.updateMany({
    where: { id: order.id, businessId: ctx.businessId, status: from },
    data: {
      status: to,
      ...(field && { [field]: now }),
      // Si se salta PREPARING, se registra igual para medir tiempos
      ...(to === "READY" && !order.preparingAt && { preparingAt: now }),
    },
  });
  if (count === 0) throw new DomainError("INVALID_TRANSITION", "El pedido cambió de estado, actualiza la pantalla");

  await audit({
    businessId: ctx.businessId,
    actor: ctx.actor,
    action: "order.status_changed",
    entityType: "order",
    entityId: order.id,
    ip: ctx.ip,
    metadata: { from, to },
  });
  emit("order.status_changed", { businessId: ctx.businessId, orderId: order.id, from, to });

  if (to === "READY") await onReady(ctx, order.id);
  return (await db.order.findUnique({ where: { id: order.id } }))!;
}

/** Al quedar LISTO: notificar. La pantalla pública lo ve en su siguiente consulta. */
async function onReady(ctx: Ctx, orderId: string) {
  const service = ctx.notifications ?? notificationService();
  try {
    await service.notifyOrderReady(orderId);
  } catch (err) {
    // Un fallo de notificación nunca revierte el cambio de estado
    console.error("[notifications] error notificando pedido", orderId, err);
  }
}
