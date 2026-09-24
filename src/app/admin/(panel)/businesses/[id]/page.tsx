import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { getCreditSummary } from "@/domain/billing/credits";
import { TX_LABEL } from "@/domain/billing/overview";
import { adjustAction, changePlanAction, resolveCreditRequest, setBusinessStatus, topUpAction } from "@/lib/actions/platform";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ROLE_LABEL, type Role } from "@/lib/constants";

export const metadata = { title: "Negocio" };


export default async function BusinessDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const business = await prisma.business.findUnique({ where: { id }, include: { users: { orderBy: { createdAt: "asc" } } } });
  if (!business) notFound();

  const [summary, plans, ledger, monthly, requests] = await Promise.all([
    getCreditSummary(prisma, id),
    prisma.plan.findMany({ where: { OR: [{ active: true }, { id: business.planId ?? "" }] }, orderBy: { monthlySmsCredits: "asc" } }),
    // Los consumos individuales se omiten para que el libro sea legible
    prisma.smsCreditTransaction.findMany({ where: { businessId: id, type: { notIn: ["USAGE", "REFUND"] } }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.smsCreditTransaction.groupBy({ by: ["period"], where: { businessId: id, type: { in: ["USAGE", "REFUND"] } }, _sum: { amount: true }, orderBy: { period: "desc" }, take: 6 }),
    prisma.creditRequest.findMany({ where: { businessId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const suspended = business.status !== "ACTIVE";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm text-slate-500 hover:underline">← Negocios</Link>
          <h1 className="text-2xl font-bold">{business.name}</h1>
          <p className="text-sm text-slate-500">{business.address ?? "Sin dirección"} · {business.country} · {business.timezone}</p>
        </div>
        <form action={setBusinessStatus.bind(null, id, suspended ? "ACTIVE" : "SUSPENDED")} className="flex items-center gap-3">
          <span className={`badge ${suspended ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-800"}`}>{suspended ? "Suspendido" : "Activo"}</span>
          {suspended ? (
            <button className="btn-primary">Reactivar</button>
          ) : (
            <ConfirmButton className="btn-danger" message="El negocio no podrá entrar, usar la API ni enviar notificaciones. ¿Suspender?">Suspender</ConfirmButton>
          )}
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Disponibles", summary.available],
          ["Incluidos del mes", `${summary.includedRemaining} / ${summary.plan?.monthlySmsCredits ?? 0}`],
          ["Adicionales", summary.extraBalance],
          ["Usados este mes", summary.usedThisPeriod],
        ].map(([label, value]) => (
          <div key={label} className="card p-4">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="text-3xl font-extrabold tabular-nums">{typeof value === "number" ? value.toLocaleString("es-CO") : value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5">
          <h2 className="font-bold">Plan</h2>
          <ActionForm action={changePlanAction} className="mt-3 space-y-3">
            <input type="hidden" name="businessId" value={id} />
            <select name="planId" defaultValue={business.planId ?? ""} className="input">
              <option value="">Sin plan (0 SMS incluidos)</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.monthlySmsCredits.toLocaleString("es-CO")} SMS/mes</option>)}
            </select>
            <p className="text-xs text-slate-500">Aplica de inmediato: los incluidos del mes se recalculan descontando lo ya usado.</p>
            <SubmitButton className="btn-secondary w-full">Cambiar plan</SubmitButton>
          </ActionForm>
        </section>

        <section className="card p-5">
          <h2 className="font-bold">Recargar créditos</h2>
          <ActionForm action={topUpAction} className="mt-3 space-y-3">
            <input type="hidden" name="businessId" value={id} />
            <input name="amount" type="number" min={1} step={1} required className="input" placeholder="Cantidad de SMS" />
            <input name="note" maxLength={200} className="input" placeholder="Referencia de pago (opcional)" />
            <SubmitButton className="btn-primary w-full">Agregar créditos</SubmitButton>
          </ActionForm>
        </section>

        <section className="card p-5">
          <h2 className="font-bold">Ajuste manual</h2>
          <ActionForm action={adjustAction} className="mt-3 space-y-3">
            <input type="hidden" name="businessId" value={id} />
            <div className="flex gap-2">
              <select name="bucket" className="input">
                <option value="EXTRA">Adicionales</option>
                <option value="INCLUDED">Incluidos</option>
              </select>
              <input name="amount" type="number" step={1} required className="input" placeholder="+/-" />
            </div>
            <input name="note" required minLength={3} maxLength={200} className="input" placeholder="Motivo (obligatorio)" />
            <SubmitButton className="btn-secondary w-full">Aplicar ajuste</SubmitButton>
          </ActionForm>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-bold">Movimientos de créditos</h2>
          {ledger.length === 0 ? <p className="text-sm text-slate-500">Sin movimientos.</p> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {ledger.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium">{TX_LABEL[t.type] ?? t.type} <span className="font-normal text-slate-400">· {t.bucket === "INCLUDED" ? "incluidos" : "adicionales"}</span></p>
                    <p className="truncate text-xs text-slate-500">{t.createdAt.toLocaleString("es-CO")}{t.note && ` · ${t.note}`}</p>
                  </div>
                  <span className={`font-semibold tabular-nums ${t.amount > 0 ? "text-emerald-700" : "text-red-600"}`}>{t.amount > 0 ? "+" : ""}{t.amount.toLocaleString("es-CO")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 font-bold">SMS enviados por mes</h2>
            {monthly.length === 0 ? <p className="text-sm text-slate-500">Aún no ha enviado SMS.</p> : (
              <ul className="divide-y divide-slate-100 text-sm">
                {monthly.map((m) => (
                  <li key={m.period} className="flex justify-between py-2"><span>{m.period}</span><span className="font-semibold tabular-nums">{(0 - (m._sum.amount ?? 0) || 0).toLocaleString("es-CO")}</span></li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-bold">Solicitudes de recarga</h2>
            {requests.length === 0 ? <p className="text-sm text-slate-500">Sin solicitudes.</p> : (
              <ul className="divide-y divide-slate-100 text-sm">
                {requests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                    <div>
                      <p className="font-medium">{r.amount.toLocaleString("es-CO")} SMS</p>
                      <p className="text-xs text-slate-500">{r.createdAt.toLocaleString("es-CO")}{r.note && ` · ${r.note}`}</p>
                    </div>
                    {r.status === "PENDING" ? (
                      <div className="flex gap-2">
                        <form action={resolveCreditRequest.bind(null, r.id, true)}><button className="btn-primary px-3 py-1.5 text-sm">Aprobar</button></form>
                        <form action={resolveCreditRequest.bind(null, r.id, false)}><button className="btn-secondary px-3 py-1.5 text-sm">Rechazar</button></form>
                      </div>
                    ) : (
                      <span className={`badge ${r.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>{r.status === "APPROVED" ? "Aprobada" : "Rechazada"}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-bold">Usuarios</h2>
            <ul className="divide-y divide-slate-100 text-sm">
              {business.users.map((u) => (
                <li key={u.id} className="flex justify-between py-2">
                  <span className={u.active ? "" : "text-slate-400 line-through"}>{u.name} <span className="text-slate-500">· {u.email}</span></span>
                  <span className="text-slate-500">{ROLE_LABEL[u.role as Role]}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
