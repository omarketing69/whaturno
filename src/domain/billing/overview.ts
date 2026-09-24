import { prisma } from "@/lib/db";
import { periodKey } from "./credits";

/**
 * Vista de solo lectura del saldo (no escribe en BD). Si el mes cambió y aún no
 * se asignaron los créditos, muestra los que tendrá al primer uso.
 */
export function effectiveCredits(b: { timezone: string; smsIncludedPeriod: string | null; smsIncludedRemaining: number; smsExtraBalance: number; plan: { monthlySmsCredits: number; active: boolean } | null }) {
  const current = periodKey(b.timezone);
  const included = b.smsIncludedPeriod === current ? b.smsIncludedRemaining : b.plan?.active ? b.plan.monthlySmsCredits : 0;
  return { period: current, included, extra: b.smsExtraBalance, available: included + b.smsExtraBalance };
}

/** SMS consumidos (USAGE − REFUND) por negocio en su periodo actual. */
export async function smsUsageByBusiness(periods: Map<string, string>) {
  const rows = await prisma.smsCreditTransaction.groupBy({
    by: ["businessId", "period"],
    where: { type: { in: ["USAGE", "REFUND"] }, period: { in: [...new Set(periods.values())] } },
    _sum: { amount: true },
  });
  const usage = new Map<string, number>();
  for (const r of rows) if (periods.get(r.businessId) === r.period) usage.set(r.businessId, 0 - (r._sum.amount ?? 0) || 0);
  return usage;
}

export const TX_LABEL: Record<string, string> = {
  MONTHLY_GRANT: "Créditos del plan",
  TOPUP: "Recarga",
  USAGE: "SMS enviado",
  REFUND: "Devolución (envío fallido)",
  ADJUSTMENT: "Ajuste",
  EXPIRE: "Vencimiento de incluidos",
};
