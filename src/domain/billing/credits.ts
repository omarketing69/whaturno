import type { Prisma, PrismaClient } from "@prisma/client";
import { localDateKey } from "@/lib/time";
import { DomainError } from "../errors";

/**
 * Créditos SMS del modelo SaaS.
 *
 * - INCLUDED: los del plan. Se asignan cada mes calendario (zona del negocio) y
 *   lo que sobra vence al cambiar de mes.
 * - EXTRA: recargas aprobadas por el superadmin. No vencen.
 *
 * Cada SMS consume primero INCLUDED y luego EXTRA. Todo movimiento queda en
 * SmsCreditTransaction, que es la base para facturar.
 * Telegram no consume créditos.
 */

type Db = PrismaClient | Prisma.TransactionClient;
export type Bucket = "INCLUDED" | "EXTRA";

export function periodKey(timeZone: string, now = new Date()): string {
  return localDateKey(now, timeZone).slice(0, 7);
}

/** Asigna los créditos del mes si todavía no se hizo (de forma perezosa y atómica). */
export async function ensurePeriod(db: Db, businessId: string, now = new Date()) {
  const business = await db.business.findUniqueOrThrow({ where: { id: businessId }, include: { plan: true } });
  const period = periodKey(business.timezone, now);
  if (business.smsIncludedPeriod === period) return business;

  const credits = business.plan?.active === false ? 0 : (business.plan?.monthlySmsCredits ?? 0);
  // La condición sobre el periodo evita asignar dos veces si hay dos requests simultáneas
  const { count } = await db.business.updateMany({
    where: { id: businessId, smsIncludedPeriod: business.smsIncludedPeriod },
    data: { smsIncludedRemaining: credits, smsIncludedPeriod: period },
  });
  if (count) {
    const entries: Prisma.SmsCreditTransactionCreateManyInput[] = [];
    if (business.smsIncludedPeriod && business.smsIncludedRemaining > 0) {
      entries.push({ businessId, type: "EXPIRE", bucket: "INCLUDED", amount: -business.smsIncludedRemaining, period: business.smsIncludedPeriod, note: "Créditos del plan no usados", actor: "system" });
    }
    if (credits > 0) {
      entries.push({ businessId, type: "MONTHLY_GRANT", bucket: "INCLUDED", amount: credits, period, note: `Plan ${business.plan?.name}`, actor: "system" });
    }
    if (entries.length) await db.smsCreditTransaction.createMany({ data: entries });
  }
  return db.business.findUniqueOrThrow({ where: { id: businessId }, include: { plan: true } });
}

/** Reserva 1 crédito para un SMS. Devuelve de qué bolsa salió, o null si no hay saldo. */
export async function reserveSmsCredit(db: Db, businessId: string, notificationId?: string): Promise<Bucket | null> {
  const business = await ensurePeriod(db, businessId);
  const period = business.smsIncludedPeriod!;
  const buckets: [Bucket, "smsIncludedRemaining" | "smsExtraBalance"][] = [
    ["INCLUDED", "smsIncludedRemaining"],
    ["EXTRA", "smsExtraBalance"],
  ];
  for (const [bucket, field] of buckets) {
    const { count } = await db.business.updateMany({
      where: { id: businessId, [field]: { gt: 0 } },
      data: { [field]: { decrement: 1 } },
    });
    if (count) {
      await db.smsCreditTransaction.create({
        data: { businessId, type: "USAGE", bucket, amount: -1, period, notificationId, actor: "system" },
      });
      return bucket;
    }
  }
  return null;
}

/** Devuelve el crédito cuando el proveedor no pudo enviar el SMS. */
export async function refundSmsCredit(db: Db, businessId: string, bucket: Bucket, notificationId?: string) {
  const business = await db.business.findUniqueOrThrow({ where: { id: businessId } });
  // Si el mes ya cambió, el crédito incluido reservado venció: se devuelve como EXTRA para no perderlo
  const target: Bucket = bucket === "INCLUDED" && business.smsIncludedPeriod !== periodKey(business.timezone) ? "EXTRA" : bucket;
  await db.business.update({
    where: { id: businessId },
    data: target === "INCLUDED" ? { smsIncludedRemaining: { increment: 1 } } : { smsExtraBalance: { increment: 1 } },
  });
  await db.smsCreditTransaction.create({
    data: { businessId, type: "REFUND", bucket: target, amount: 1, period: business.smsIncludedPeriod, notificationId, note: "Envío fallido", actor: "system" },
  });
}

/** Recarga de créditos adicionales (los aprueba el superadmin). */
export async function topUpCredits(db: Db, businessId: string, amount: number, actor: string, note?: string) {
  if (!Number.isInteger(amount) || amount <= 0 || amount > 1_000_000) throw new DomainError("VALIDATION", "Cantidad de créditos no válida");
  const business = await ensurePeriod(db, businessId);
  await db.business.update({ where: { id: businessId }, data: { smsExtraBalance: { increment: amount } } });
  await db.smsCreditTransaction.create({
    data: { businessId, type: "TOPUP", bucket: "EXTRA", amount, period: business.smsIncludedPeriod, note, actor },
  });
}

/** Ajuste manual (positivo o negativo) de una bolsa. Nunca deja saldo negativo. */
export async function adjustCredits(db: Db, businessId: string, bucket: Bucket, amount: number, actor: string, note: string) {
  if (!Number.isInteger(amount) || amount === 0) throw new DomainError("VALIDATION", "El ajuste debe ser un entero distinto de 0");
  const business = await ensurePeriod(db, businessId);
  const field = bucket === "INCLUDED" ? "smsIncludedRemaining" : "smsExtraBalance";
  const { count } = await db.business.updateMany({
    where: { id: businessId, ...(amount < 0 && { [field]: { gte: -amount } }) },
    data: { [field]: { increment: amount } },
  });
  if (!count) throw new DomainError("VALIDATION", "El saldo no puede quedar negativo");
  await db.smsCreditTransaction.create({
    data: { businessId, type: "ADJUSTMENT", bucket, amount, period: business.smsIncludedPeriod, note, actor },
  });
}

/**
 * Cambia el plan. Aplica desde ya: los incluidos del mes pasan a ser
 * (créditos del nuevo plan − incluidos ya usados este mes), mínimo 0.
 */
export async function changePlan(db: Db, businessId: string, planId: string | null, actor: string) {
  const business = await ensurePeriod(db, businessId);
  const plan = planId ? await db.plan.findUnique({ where: { id: planId } }) : null;
  if (planId && !plan) throw new DomainError("NOT_FOUND", "Plan no encontrado");

  const usedIncluded = await includedUsedInPeriod(db, businessId, business.smsIncludedPeriod!);
  const newRemaining = Math.max(0, (plan?.monthlySmsCredits ?? 0) - usedIncluded);
  const delta = newRemaining - business.smsIncludedRemaining;

  await db.business.update({ where: { id: businessId }, data: { planId: plan?.id ?? null, smsIncludedRemaining: newRemaining } });
  if (delta !== 0) {
    await db.smsCreditTransaction.create({
      data: { businessId, type: "ADJUSTMENT", bucket: "INCLUDED", amount: delta, period: business.smsIncludedPeriod, note: `Cambio a plan ${plan?.name ?? "sin plan"}`, actor },
    });
  }
}

async function includedUsedInPeriod(db: Db, businessId: string, period: string): Promise<number> {
  const agg = await db.smsCreditTransaction.aggregate({
    where: { businessId, period, bucket: "INCLUDED", type: { in: ["USAGE", "REFUND"] } },
    _sum: { amount: true },
  });
  return 0 - (agg._sum.amount ?? 0) || 0;
}

/** SMS efectivamente consumidos en un periodo (USAGE − REFUND), ambas bolsas. */
export async function smsUsedInPeriod(db: Db, businessId: string, period: string): Promise<number> {
  const agg = await db.smsCreditTransaction.aggregate({
    where: { businessId, period, type: { in: ["USAGE", "REFUND"] } },
    _sum: { amount: true },
  });
  return 0 - (agg._sum.amount ?? 0) || 0;
}

export async function getCreditSummary(db: Db, businessId: string) {
  const b = await ensurePeriod(db, businessId);
  const used = await smsUsedInPeriod(db, businessId, b.smsIncludedPeriod!);
  const planCredits = b.plan?.monthlySmsCredits ?? 0;
  const available = b.smsIncludedRemaining + b.smsExtraBalance;
  return {
    period: b.smsIncludedPeriod!,
    plan: b.plan ? { id: b.plan.id, name: b.plan.name, monthlySmsCredits: planCredits } : null,
    includedRemaining: b.smsIncludedRemaining,
    extraBalance: b.smsExtraBalance,
    available,
    usedThisPeriod: used,
    // Aviso de saldo bajo: menos del 10 % del plan (o menos de 20 si no hay plan)
    low: available < Math.max(20, Math.ceil(planCredits * 0.1)),
  };
}
