import { NextResponse } from "next/server";
import { z } from "zod";
import { ORDER_SOURCES } from "@/lib/constants";
import { readJson, serializeOrder, withApiKey } from "@/lib/api/v1";
import { createOrder } from "@/domain/orders/orderService";

export const dynamic = "force-dynamic";

const createSchema = z
  .object({
    external_order_id: z.string().trim().min(1).max(64).optional(),
    order_number: z.string().trim().min(1).max(20).regex(/^[#\w-]+$/).optional(),
    customer: z.object({ phone: z.string().trim().min(5).max(30), name: z.string().trim().max(80).optional() }).optional(),
    status: z.enum(["NEW", "PREPARING", "READY"]).default("NEW"),
    source: z.enum(ORDER_SOURCES).exclude(["MANUAL"]).optional(),
    notify: z.boolean().default(true),
    consent: z.object({ notification: z.boolean().default(true), marketing: z.boolean().default(false) }).default({}),
  })
  .strict()
  .refine((d) => d.external_order_id || d.order_number, { message: "Envía external_order_id u order_number" });

/** POST /api/v1/orders — registra un pedido desde un sistema externo (idempotente por external_order_id). */
export async function POST(req: Request) {
  return withApiKey(req, async ({ key, ip }) => {
    const body = createSchema.parse(await readJson(req));
    const { order, created } = await createOrder(
      { businessId: key.businessId, actor: `apikey:${key.id}`, ip },
      {
        externalOrderId: body.external_order_id,
        orderNumber: body.order_number,
        phone: body.customer?.phone,
        customerName: body.customer?.name,
        source: body.source ?? (key.source as (typeof ORDER_SOURCES)[number]),
        status: body.status,
        notify: body.notify && body.consent.notification,
        consent: { notification: body.consent.notification, marketing: body.consent.marketing, source: `API:${key.id}` },
      },
    );
    return NextResponse.json({ data: await serializeOrder(order), created }, { status: created ? 201 : 200 });
  });
}
