import type { OrderStatus } from "@/lib/constants";

/**
 * Bus de eventos en proceso. Punto de extensión para el ecosistema: por ejemplo,
 * un futuro webhook hacia WhatsOrder/Domi911 se suscribe a "order.status_changed"
 * sin que OrderService tenga que conocer esas apps.
 */
export type DomainEvents = {
  "order.created": { businessId: string; orderId: string; source: string };
  "order.status_changed": { businessId: string; orderId: string; from: OrderStatus | null; to: OrderStatus };
};

type Handler<K extends keyof DomainEvents> = (payload: DomainEvents[K]) => void | Promise<void>;
const handlers = new Map<keyof DomainEvents, Handler<never>[]>();

export function on<K extends keyof DomainEvents>(event: K, handler: Handler<K>) {
  handlers.set(event, [...(handlers.get(event) ?? []), handler as Handler<never>]);
}

export function emit<K extends keyof DomainEvents>(event: K, payload: DomainEvents[K]) {
  for (const h of (handlers.get(event) ?? []) as Handler<K>[]) {
    Promise.resolve()
      .then(() => h(payload))
      .catch((err) => console.error(`[events] ${event}`, err));
  }
}
