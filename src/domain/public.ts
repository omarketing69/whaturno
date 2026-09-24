import { prisma } from "@/lib/db";
import { safeEqual } from "@/lib/tokens";
import { STATUS_LABEL, type OrderStatus } from "@/lib/constants";

/** Negocio si el token de pantalla coincide; null en cualquier otro caso (sin revelar cuál falló). */
export async function businessForDisplay(businessId: string, token: string) {
  if (businessId.length > 40 || token.length > 64) return null;
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business || !safeEqual(business.displayToken, token)) return null;
  return business;
}

/** Estado público de un pedido por su token de seguimiento. Sin teléfono, nombre ni IDs internos. */
export async function publicOrderStatus(token: string) {
  if (token.length > 64) return null;
  const order = await prisma.order.findUnique({
    where: { trackingToken: token },
    select: {
      orderNumber: true,
      status: true,
      createdAt: true,
      readyAt: true,
      business: { select: { name: true, logoUrl: true, brandColor: true, telegramEnabled: true } },
    },
  });
  if (!order) return null;
  return {
    orderNumber: order.orderNumber,
    status: order.status as OrderStatus,
    statusLabel: STATUS_LABEL[order.status as OrderStatus],
    createdAt: order.createdAt.toISOString(),
    readyAt: order.readyAt?.toISOString() ?? null,
    business: { name: order.business.name, logoUrl: order.business.logoUrl, brandColor: order.business.brandColor },
    telegramEnabled: order.business.telegramEnabled && Boolean(process.env.TELEGRAM_BOT_USERNAME),
  };
}
export type PublicOrderStatus = NonNullable<Awaited<ReturnType<typeof publicOrderStatus>>>;
