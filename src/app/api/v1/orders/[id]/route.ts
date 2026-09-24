import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, readJson, serializeOrder, withApiKey, type ApiContext } from "@/lib/api/v1";
import { changeOrderStatus } from "@/domain/orders/orderService";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * {id} es el id de Digiturno. Con ?lookup=external se interpreta como el
 * external_order_id del sistema origen (el origen asociado a la API key).
 */
async function findOrder(req: Request, { key }: ApiContext, id: string) {
  const lookup = new URL(req.url).searchParams.get("lookup");
  if (id.length > 64) return null;
  if (lookup === "external") {
    return prisma.order.findFirst({ where: { businessId: key.businessId, source: key.source, externalOrderId: id }, orderBy: { createdAt: "desc" } });
  }
  return prisma.order.findFirst({ where: { id, businessId: key.businessId } });
}

export async function GET(req: Request, { params }: Params) {
  return withApiKey(req, async (ctx) => {
    const order = await findOrder(req, ctx, (await params).id);
    if (!order) return apiError(404, "NOT_FOUND", "Pedido no encontrado");
    return NextResponse.json({ data: await serializeOrder(order) });
  });
}

const patchSchema = z.object({ status: z.enum(["PREPARING", "READY", "DELIVERED", "CANCELLED"]) }).strict();

/** PATCH /api/v1/orders/{id} — { "status": "READY" } registra ready_at y notifica al cliente. */
export async function PATCH(req: Request, { params }: Params) {
  return withApiKey(req, async (ctx) => {
    const body = patchSchema.parse(await readJson(req));
    const order = await findOrder(req, ctx, (await params).id);
    if (!order) return apiError(404, "NOT_FOUND", "Pedido no encontrado");
    const updated = await changeOrderStatus({ businessId: ctx.key.businessId, actor: `apikey:${ctx.key.id}`, ip: ctx.ip }, order.id, body.status);
    return NextResponse.json({ data: await serializeOrder(updated) });
  });
}
