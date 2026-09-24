import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { adjustCredits, changePlan, ensurePeriod, getCreditSummary, topUpCredits } from "@/domain/billing/credits";
import { changeOrderStatus, createOrder } from "@/domain/orders/orderService";
import { FakeSms, fakeNotifications, makeBusiness } from "./helpers";

const consent = { notification: true, marketing: false, source: "MANUAL:test" };

async function readyOrder(businessId: string, sms: FakeSms, n: string) {
  const { service } = fakeNotifications(sms);
  const ctx = { businessId, actor: "user:u1" as const, notifications: service };
  const { order } = await createOrder(ctx, { orderNumber: n, phone: "3155551234", source: "MANUAL", consent });
  await changeOrderStatus(ctx, order.id, "READY");
  return prisma.notification.findFirstOrThrow({ where: { orderId: order.id } });
}

async function planWith(credits: number) {
  return prisma.plan.create({ data: { name: "P" + credits + Math.random(), monthlySmsCredits: credits } });
}

describe("créditos SMS", () => {
  it("consume primero los incluidos y luego los adicionales; sin saldo falla sin romper el pedido", async () => {
    const plan = await planWith(1);
    const b = await makeBusiness({ planId: plan.id, smsExtraBalance: 1 });
    const sms = new FakeSms();

    await readyOrder(b.id, sms, "1");
    let s = await getCreditSummary(prisma, b.id);
    expect(s).toMatchObject({ includedRemaining: 0, extraBalance: 1, usedThisPeriod: 1 });

    await readyOrder(b.id, sms, "2");
    s = await getCreditSummary(prisma, b.id);
    expect(s).toMatchObject({ includedRemaining: 0, extraBalance: 0, usedThisPeriod: 2, low: true });

    const n = await readyOrder(b.id, sms, "3");
    expect(n).toMatchObject({ status: "FAILED", provider: "billing" });
    expect(n.errorMessage).toContain("Sin créditos");
    expect(sms.sent).toHaveLength(2);
  });

  it("devuelve el crédito si el proveedor falla", async () => {
    const b = await makeBusiness({ smsExtraBalance: 5 });
    const n = await readyOrder(b.id, new FakeSms(true), "1");
    expect(n.status).toBe("FAILED");
    const s = await getCreditSummary(prisma, b.id);
    expect(s).toMatchObject({ extraBalance: 5, usedThisPeriod: 0 });
    const types = (await prisma.smsCreditTransaction.findMany({ where: { businessId: b.id }, orderBy: { createdAt: "asc" } })).map((t) => t.type);
    expect(types).toEqual(["USAGE", "REFUND"]);
  });

  it("al cambiar de mes vencen los incluidos no usados y se asignan los nuevos; los adicionales se mantienen", async () => {
    const plan = await planWith(100);
    const b = await makeBusiness({ planId: plan.id, smsExtraBalance: 7 });
    await prisma.business.update({ where: { id: b.id }, data: { smsIncludedPeriod: "2000-01", smsIncludedRemaining: 40 } });
    const after = await ensurePeriod(prisma, b.id);
    expect(after.smsIncludedRemaining).toBe(100);
    expect(after.smsExtraBalance).toBe(7);
    const ledger = await prisma.smsCreditTransaction.findMany({ where: { businessId: b.id } });
    expect(ledger.map((t) => [t.type, t.amount]).sort()).toEqual([["EXPIRE", -40], ["MONTHLY_GRANT", 100]]);
    // Idempotente
    await ensurePeriod(prisma, b.id);
    expect(await prisma.smsCreditTransaction.count({ where: { businessId: b.id } })).toBe(2);
  });

  it("recarga, ajuste sin saldo negativo y cambio de plan descontando lo usado", async () => {
    const small = await planWith(10);
    const big = await planWith(50);
    const b = await makeBusiness({ planId: small.id, smsExtraBalance: 0 });
    const sms = new FakeSms();
    for (const n of ["1", "2", "3"]) await readyOrder(b.id, sms, n);

    await topUpCredits(prisma, b.id, 500, "platform:x", "pago 123");
    await expect(adjustCredits(prisma, b.id, "EXTRA", -501, "platform:x", "error")).rejects.toMatchObject({ code: "VALIDATION" });
    await adjustCredits(prisma, b.id, "EXTRA", -100, "platform:x", "corrección");

    await changePlan(prisma, b.id, big.id, "platform:x");
    const s = await getCreditSummary(prisma, b.id);
    expect(s).toMatchObject({ includedRemaining: 47, extraBalance: 400, plan: { id: big.id } });
  });
});
