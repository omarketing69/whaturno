import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { changeOrderStatus, createOrder } from "@/domain/orders/orderService";
import { DomainError } from "@/domain/errors";
import { FakeSms, fakeNotifications, makeBusiness } from "./helpers";

const consent = (notification = true, marketing = false) => ({ notification, marketing, source: "MANUAL:test" });

describe("pedidos", () => {
  it("flujo completo: registrar → preparando → listo (SMS) → entregado", async () => {
    const b = await makeBusiness({ name: "Pan Rico" });
    const { sms, service } = fakeNotifications();
    const ctx = { businessId: b.id, actor: "user:u1" as const, notifications: service };

    const { order } = await createOrder(ctx, { orderNumber: "583", phone: "315 555 1234", source: "MANUAL", consent: consent() });
    expect(order.status).toBe("NEW");
    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: order.customerId! } });
    expect(customer.phone).toBe("+573155551234");

    await changeOrderStatus(ctx, order.id, "PREPARING");
    const ready = await changeOrderStatus(ctx, order.id, "READY");
    expect(ready.readyAt).toBeTruthy();
    expect(sms.sent).toHaveLength(1);
    expect(sms.sent[0]).toMatchObject({ phone: "+573155551234" });
    expect(sms.sent[0].message).toContain("#583");
    expect(sms.sent[0].message).toContain("Pan Rico");

    const notif = await prisma.notification.findFirstOrThrow({ where: { orderId: order.id } });
    expect(notif).toMatchObject({ channel: "SMS", status: "SENT", provider: "fake" });

    const delivered = await changeOrderStatus(ctx, order.id, "DELIVERED");
    expect(delivered.deliveredAt).toBeTruthy();
  });

  it("el mismo teléfono en distintos formatos es el mismo cliente", async () => {
    const b = await makeBusiness();
    const ctx = { businessId: b.id, actor: "user:u1" as const, notifications: fakeNotifications().service };
    const a = await createOrder(ctx, { orderNumber: "1", phone: "3155551234", source: "MANUAL", consent: consent() });
    const c = await createOrder(ctx, { orderNumber: "2", phone: "+57 315 555 1234", source: "MANUAL", consent: consent() });
    expect(a.order.customerId).toBe(c.order.customerId);
  });

  it("celular obligatorio y válido", async () => {
    const b = await makeBusiness();
    const ctx = { businessId: b.id, actor: "user:u1" as const };
    await expect(createOrder(ctx, { orderNumber: "1", source: "MANUAL", consent: consent() })).rejects.toMatchObject({ code: "PHONE_REQUIRED" });
    await expect(createOrder(ctx, { orderNumber: "1", phone: "12", source: "MANUAL", consent: consent() })).rejects.toMatchObject({ code: "INVALID_PHONE" });
  });

  it("no permite dos pedidos activos con el mismo número", async () => {
    const b = await makeBusiness();
    const ctx = { businessId: b.id, actor: "user:u1" as const };
    await createOrder(ctx, { orderNumber: "10", phone: "3155551234", source: "MANUAL", consent: consent() });
    await expect(createOrder(ctx, { orderNumber: "10", phone: "3155550000", source: "MANUAL", consent: consent() })).rejects.toMatchObject({
      code: "DUPLICATE_ACTIVE_ORDER",
    });
  });

  it("transiciones inválidas", async () => {
    const b = await makeBusiness();
    const ctx = { businessId: b.id, actor: "user:u1" as const };
    const { order } = await createOrder(ctx, { orderNumber: "5", phone: "3155551234", source: "MANUAL", consent: consent() });
    await expect(changeOrderStatus(ctx, order.id, "DELIVERED")).rejects.toBeInstanceOf(DomainError);
  });

  it("sin consentimiento de notificación no se envía SMS; marketing es independiente", async () => {
    const b = await makeBusiness();
    const { sms, service } = fakeNotifications();
    const ctx = { businessId: b.id, actor: "user:u1" as const, notifications: service };
    const { order } = await createOrder(ctx, { orderNumber: "7", phone: "3155557777", source: "MANUAL", consent: consent(false, true) });
    await changeOrderStatus(ctx, order.id, "READY");
    expect(sms.sent).toHaveLength(0);
    const c = await prisma.consent.findUniqueOrThrow({ where: { customerId: order.customerId! } });
    expect(c).toMatchObject({ notificationConsent: false, marketingConsent: true, consentSource: "MANUAL:test" });
  });

  it("un 'no' a marketing en un pedido posterior no revoca el consentimiento previo", async () => {
    const b = await makeBusiness();
    const ctx = { businessId: b.id, actor: "user:u1" as const };
    const first = await createOrder(ctx, { orderNumber: "1", phone: "3155551111", source: "MANUAL", consent: consent(true, true) });
    await createOrder(ctx, { orderNumber: "2", phone: "3155551111", source: "MANUAL", consent: consent(true, false) });
    const c = await prisma.consent.findUniqueOrThrow({ where: { customerId: first.order.customerId! } });
    expect(c.marketingConsent).toBe(true);
  });

  it("SMS fallido queda registrado como FAILED y no revierte el estado", async () => {
    const b = await makeBusiness();
    const { service } = fakeNotifications(new FakeSms(true));
    const ctx = { businessId: b.id, actor: "user:u1" as const, notifications: service };
    const { order } = await createOrder(ctx, { orderNumber: "9", phone: "3155551234", source: "MANUAL", consent: consent() });
    const ready = await changeOrderStatus(ctx, order.id, "READY");
    expect(ready.status).toBe("READY");
    const n = await prisma.notification.findFirstOrThrow({ where: { orderId: order.id } });
    expect(n).toMatchObject({ status: "FAILED", errorMessage: "boom" });
  });

  it("numeración automática con prefijo", async () => {
    const b = await makeBusiness({ numberingMode: "AUTO", orderPrefix: "A" });
    const ctx = { businessId: b.id, actor: "user:u1" as const };
    const o1 = await createOrder(ctx, { phone: "3155551234", source: "MANUAL", consent: consent() });
    const o2 = await createOrder(ctx, { phone: "3155551234", source: "MANUAL", consent: consent() });
    expect([o1.order.orderNumber, o2.order.orderNumber]).toEqual(["A1", "A2"]);
  });

  it("aislamiento: un negocio no puede modificar pedidos de otro", async () => {
    const a = await makeBusiness();
    const b = await makeBusiness();
    const { order } = await createOrder({ businessId: a.id, actor: "user:u1" }, { orderNumber: "1", phone: "3155551234", source: "MANUAL", consent: consent() });
    await expect(changeOrderStatus({ businessId: b.id, actor: "user:u2" }, order.id, "PREPARING")).rejects.toMatchObject({ code: "NOT_FOUND" });
    const still = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(still.status).toBe("NEW");
  });

  it("idempotencia por external_order_id + origen", async () => {
    const b = await makeBusiness();
    const ctx = { businessId: b.id, actor: "apikey:k1" as const };
    const input = { externalOrderId: "WO-1", phone: "+573155551234", source: "WHATSORDER" as const, consent: consent() };
    const first = await createOrder(ctx, input);
    const second = await createOrder(ctx, input);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.order.id).toBe(first.order.id);
  });
});
