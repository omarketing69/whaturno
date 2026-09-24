import { NextResponse } from "next/server";
import type { ApiKey, Order } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { authenticateApiKey } from "../auth/apiKey";
import { clientIp, rateLimit } from "../rateLimit";
import { trackingUrl } from "../config";
import { maskPhone } from "../phone";
import { DomainError } from "@/domain/errors";

export type ApiContext = { key: ApiKey; ip: string };

export function apiError(status: number, code: string, message: string, headers?: HeadersInit) {
  return NextResponse.json({ error: { code, message } }, { status, headers });
}

/** Autenticación por API key + rate limit por key + manejo uniforme de errores. */
export async function withApiKey(req: Request, handler: (ctx: ApiContext) => Promise<Response>): Promise<Response> {
  const ip = clientIp(req.headers);
  if (!rateLimit(`api-ip:${ip}`, 600, 60_000).ok) return apiError(429, "RATE_LIMITED", "Demasiadas solicitudes");
  const key = await authenticateApiKey(req.headers);
  if (!key) return apiError(401, "UNAUTHORIZED", "API key inválida o ausente. Usa 'Authorization: Bearer <key>'.");
  const limit = rateLimit(`api-key:${key.id}`, 300, 60_000);
  if (!limit.ok) return apiError(429, "RATE_LIMITED", "Demasiadas solicitudes", { "Retry-After": String(limit.retryAfter) });
  try {
    return await handler({ key, ip });
  } catch (err) {
    if (err instanceof DomainError) return apiError(err.httpStatus, err.code, err.message);
    if (err instanceof z.ZodError) {
      return apiError(422, "VALIDATION", err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
    }
    console.error("[api/v1]", err);
    return apiError(500, "INTERNAL", "Error interno");
  }
}

export async function readJson(req: Request): Promise<unknown> {
  if (!req.headers.get("content-type")?.includes("application/json")) {
    throw new DomainError("VALIDATION", "Content-Type debe ser application/json");
  }
  const text = await req.text();
  if (text.length > 10_000) throw new DomainError("VALIDATION", "Cuerpo demasiado grande");
  try {
    return JSON.parse(text);
  } catch {
    throw new DomainError("VALIDATION", "JSON inválido");
  }
}

/** Representación pública del pedido en la API (snake_case, teléfono enmascarado). */
export async function serializeOrder(order: Order) {
  const [customer, notification] = await Promise.all([
    order.customerId ? prisma.customer.findUnique({ where: { id: order.customerId }, select: { phone: true, name: true } }) : null,
    prisma.notification.findFirst({ where: { orderId: order.id }, orderBy: { createdAt: "desc" }, select: { channel: true, status: true, errorMessage: true, sentAt: true } }),
  ]);
  return {
    id: order.id,
    order_number: order.orderNumber,
    external_order_id: order.externalOrderId,
    source: order.source,
    status: order.status,
    tracking_url: trackingUrl(order.trackingToken),
    customer: customer ? { phone: maskPhone(customer.phone), name: customer.name } : null,
    notification: notification
      ? { channel: notification.channel, status: notification.status, error: notification.errorMessage, sent_at: notification.sentAt }
      : null,
    created_at: order.createdAt,
    preparing_at: order.preparingAt,
    ready_at: order.readyAt,
    delivered_at: order.deliveredAt,
    cancelled_at: order.cancelledAt,
  };
}
