import { prisma } from "@/lib/db";

export type BoardOrder = {
  id: string;
  orderNumber: string;
  status: "NEW" | "PREPARING" | "READY";
  source: string;
  createdAt: string;
  readyAt: string | null;
  notification: { channel: string; status: string } | null;
};

/** Pedidos activos para la pantalla de cocina (sin datos del cliente). */
export async function getBoard(businessId: string): Promise<BoardOrder[]> {
  const orders = await prisma.order.findMany({
    where: { businessId, status: { in: ["NEW", "PREPARING", "READY"] } },
    orderBy: { createdAt: "asc" },
    take: 300,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      source: true,
      createdAt: true,
      readyAt: true,
      notifications: { orderBy: { createdAt: "desc" }, take: 1, select: { channel: true, status: true } },
    },
  });
  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status as BoardOrder["status"],
    source: o.source,
    createdAt: o.createdAt.toISOString(),
    readyAt: o.readyAt?.toISOString() ?? null,
    notification: o.notifications[0] ?? null,
  }));
}

/** Números listos para la pantalla pública: sin nombre, teléfono ni valores. */
export async function getReadyForDisplay(businessId: string) {
  const orders = await prisma.order.findMany({
    where: { businessId, status: "READY" },
    orderBy: { readyAt: "asc" },
    take: 60,
    select: { orderNumber: true, readyAt: true },
  });
  return orders.map((o) => ({ number: o.orderNumber, readyAt: o.readyAt?.toISOString() ?? null }));
}
