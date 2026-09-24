import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { resolveCreditRequest } from "@/lib/actions/platform";

export const metadata = { title: "Solicitudes de recarga" };

export default async function RequestsPage() {
  await requirePlatformAdmin();
  const [pending, recent] = await Promise.all([
    prisma.creditRequest.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, include: { business: { select: { id: true, name: true, smsExtraBalance: true } } } }),
    prisma.creditRequest.findMany({ where: { status: { not: "PENDING" } }, orderBy: { resolvedAt: "desc" }, take: 20, include: { business: { select: { id: true, name: true } } } }),
  ]);
  const users = new Map(
    (await prisma.user.findMany({ where: { id: { in: pending.map((r) => r.requestedBy) } }, select: { id: true, name: true, email: true } })).map((u) => [u.id, u]),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Solicitudes de recarga</h1>
        <p className="text-sm text-slate-500">Aprueba cuando hayas recibido el pago. Los créditos se suman de inmediato a los adicionales del negocio.</p>
      </div>

      <section className="card divide-y divide-slate-100">
        {pending.length === 0 && <p className="p-8 text-center text-slate-500">No hay solicitudes pendientes.</p>}
        {pending.map((r) => {
          const u = users.get(r.requestedBy);
          return (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-lg font-bold">{r.amount.toLocaleString("es-CO")} SMS · <Link href={`/admin/businesses/${r.business.id}`} className="text-brand-700 hover:underline">{r.business.name}</Link></p>
                <p className="text-sm text-slate-500">
                  {r.createdAt.toLocaleString("es-CO")} · {u ? `${u.name} (${u.email})` : "usuario eliminado"} · saldo adicional actual {r.business.smsExtraBalance.toLocaleString("es-CO")}
                </p>
                {r.note && <p className="mt-1 text-sm">“{r.note}”</p>}
              </div>
              <div className="flex gap-2">
                <form action={resolveCreditRequest.bind(null, r.id, true)}><button className="btn-primary">Aprobar</button></form>
                <form action={resolveCreditRequest.bind(null, r.id, false)}><button className="btn-secondary">Rechazar</button></form>
              </div>
            </div>
          );
        })}
      </section>

      {recent.length > 0 && (
        <section>
          <h2 className="mb-2 font-bold">Resueltas recientemente</h2>
          <div className="card divide-y divide-slate-100 text-sm">
            {recent.map((r) => (
              <div key={r.id} className="flex justify-between p-3">
                <span>{r.amount.toLocaleString("es-CO")} SMS · {r.business.name}</span>
                <span className={r.status === "APPROVED" ? "text-emerald-700" : "text-slate-500"}>{r.status === "APPROVED" ? "Aprobada" : "Rechazada"} · {r.resolvedAt?.toLocaleDateString("es-CO")}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
