"use server";

import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "../db";
import { requireUser } from "../auth/session";
import { requestIp } from "../request";
import { trackingUrl } from "../config";
import { ORDER_STATUSES } from "../constants";
import { createOrder, changeOrderStatus } from "@/domain/orders/orderService";
import { DomainError } from "@/domain/errors";

export type CreateOrderState =
  | { error?: string; values?: { orderNumber?: string; phone?: string } }
  | { success: { orderNumber: string; channel: string; trackingUrl: string; qrSvg: string } }
  | undefined;

const schema = z.object({
  orderNumber: z.string().trim().max(20, "Número de pedido demasiado largo").regex(/^[#\w-]*$/, "Usa solo letras, números o guiones").optional(),
  phone: z.string().trim().max(30).optional(),
  notificationConsent: z.literal("on").optional(),
  marketingConsent: z.literal("on").optional(),
});

export async function createOrderAction(_: CreateOrderState, form: FormData): Promise<CreateOrderState> {
  const user = await requireUser(["ADMIN", "CASHIER"]);
  const parsed = schema.safeParse(Object.fromEntries(form));
  const values = { orderNumber: String(form.get("orderNumber") ?? ""), phone: String(form.get("phone") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  const notify = parsed.data.notificationConsent === "on";
  try {
    const { order } = await createOrder(
      { businessId: user.businessId, actor: `user:${user.id}`, ip: await requestIp() },
      {
        orderNumber: parsed.data.orderNumber,
        phone: parsed.data.phone,
        source: "MANUAL",
        notify,
        consent: { notification: notify, marketing: parsed.data.marketingConsent === "on", source: `MANUAL:${user.id}` },
      },
    );
    const business = await prisma.business.findUniqueOrThrow({ where: { id: user.businessId } });
    const customer = order.customerId ? await prisma.customer.findUnique({ where: { id: order.customerId } }) : null;
    const channel = !order.notify
      ? "Sin notificación"
      : business.telegramEnabled && customer?.telegramChatId
        ? "Telegram"
        : business.smsEnabled
          ? "SMS"
          : "Sin canal activo";
    const url = trackingUrl(order.trackingToken);
    revalidatePath("/kitchen");
    return {
      success: {
        orderNumber: order.orderNumber,
        channel,
        trackingUrl: url,
        qrSvg: await QRCode.toString(url, { type: "svg", margin: 1, width: 180 }),
      },
    };
  } catch (err) {
    if (err instanceof DomainError) return { error: err.message, values };
    throw err;
  }
}

const statusSchema = z.object({ orderId: z.string().min(1).max(40), status: z.enum(ORDER_STATUSES) });

/** Cambio de estado desde cocina/historial. */
export async function changeStatusAction(orderId: string, status: string): Promise<{ error?: string }> {
  const user = await requireUser(["ADMIN", "CASHIER", "KITCHEN"]);
  const parsed = statusSchema.safeParse({ orderId, status });
  if (!parsed.success) return { error: "Solicitud no válida" };
  // Cocina no cancela pedidos
  if (user.role === "KITCHEN" && parsed.data.status === "CANCELLED") return { error: "No tienes permiso para cancelar" };
  try {
    await changeOrderStatus({ businessId: user.businessId, actor: `user:${user.id}`, ip: await requestIp() }, parsed.data.orderId, parsed.data.status);
    return {};
  } catch (err) {
    if (err instanceof DomainError) return { error: err.message };
    throw err;
  }
}
