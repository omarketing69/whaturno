import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { effectiveCredits, smsUsageByBusiness } from "@/domain/billing/overview";

export const metadata = { title: "Negocios" };

export default async function BusinessesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePlatformAdmin();
  const q = ((await searchParams).q ?? "").trim().slice(0, 60);
  const businesses = await prisma.business.findMany({
    where: q ? { name: { contains: q } } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { plan: true, _count: { select: { users: true } } },
  });
  const rows = businesses.map((b) => ({ b, credits: effectiveCredits(b) }));
  const usage = await smsUsageByBusiness(new Map(rows.map((r) => [r.b.id, r.credits.period])));
  const totalUsage = [...usage.values()].reduce((a, n) => a + n, 0);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Negocios</h1>
          <p className="text-sm text-slate-500">{businesses.length} negocios · {totalUsage.toLocaleString("es-CO")} SMS enviados este mes</p>
        </div>
        <form className="flex gap-2">
          <input name="q" defaultValue={q} className="input py-2" placeholder="Buscar negocio" />
          <button className="btn-secondary">Buscar</button>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Negocio</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3 text-right">SMS este mes</th>
              <th className="px-4 py-3 text-right">Incluidos</th>
              <th className="px-4 py-3 text-right">Adicionales</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ b, credits }) => {
              const low = credits.available < Math.max(20, Math.ceil((b.plan?.monthlySmsCredits ?? 0) * 0.1));
              return (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/businesses/${b.id}`} className="font-semibold text-brand-700 hover:underline">{b.name}</Link>
                    <p className="text-xs text-slate-500">{b._count.users} usuarios · desde {b.createdAt.toLocaleDateString("es-CO")}</p>
                  </td>
                  <td className="px-4 py-3">{b.plan?.name ?? <span className="text-slate-400">Sin plan</span>}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{(usage.get(b.id) ?? 0).toLocaleString("es-CO")}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{credits.included.toLocaleString("es-CO")}<span className="text-slate-400"> / {(b.plan?.monthlySmsCredits ?? 0).toLocaleString("es-CO")}</span></td>
                  <td className={`px-4 py-3 text-right tabular-nums ${low ? "font-semibold text-red-600" : ""}`}>{credits.extra.toLocaleString("es-CO")}{low && " ⚠"}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${b.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>{b.status === "ACTIVE" ? "Activo" : "Suspendido"}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-8 text-center text-slate-500">No hay negocios.</p>}
      </div>
    </div>
  );
}
