import type { OrderStatus } from "@/lib/constants";

/** Máquina de estados de la espera (no es un KDS). */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["PREPARING", "READY", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

/** Siguiente paso principal que muestra la pantalla de cocina. */
export const NEXT_STEP: Partial<Record<OrderStatus, OrderStatus>> = {
  NEW: "PREPARING",
  PREPARING: "READY",
  READY: "DELIVERED",
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Campo de fecha que se registra al entrar en cada estado. */
export const TIMESTAMP_FIELD: Partial<Record<OrderStatus, "preparingAt" | "readyAt" | "deliveredAt" | "cancelledAt">> = {
  PREPARING: "preparingAt",
  READY: "readyAt",
  DELIVERED: "deliveredAt",
  CANCELLED: "cancelledAt",
};
