import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { dateRange, formatDate, formatTime, minutesBetween, type RangeKey } from "@/lib/time";
import { maskPhone, normalizePhone } from "@/lib/phone";
import { STATUS_LABEL, type OrderStatus } from "@/lib/constants";

export const metadata: Metadata = { title: "Historial" };
export const dynamic = "force-dynamic";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Hoy" },
  { key: "yesterday", label: "Ayer" },
  { key: "week", label: "Esta semana" },
  { key: "month", label: "Este mes" },
];

const STATUS_TONE: Record<OrderStatus, string> = {
  NEW: "bg-slate-100 text-slate-700",
  PREPARING: "bg-amber-100 text-amber-800",
  READY: "bg-emerald-100 text-emerald-800",
  DELIVERED: "bg-slate-800 text-white",
  CANCELLED: "bg-red-100 text-red-700",
};

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ range?: string; q?: string }> }) {
  const user = await requireUser(["ADMIN", "CASHIER"]);
  const business = await prisma.business.findUniqueOrThrow({ where: { id: user.businessId } });
  const sp = await searchParams;
  const range: RangeKey = RANGES.some((r) => r.key === sp.range) ? (sp.range as RangeKey) : "today";
  const q = (sp.q ?? "").trim().slice(0, 30);
  const tz = business.timezone;
  const { from, to } = dateRange(range, tz);

  const where: Prisma.OrderWhereInput = { businessId: business.id, createdAt: { gte: from, lt: to } };
  if (q) {
    const digits = q.replace(/\D/g, "");
    const phone = normalizePhone(q, business.country);
    const or: Prisma.OrderWhereInput[] = [{ orderNumber: { contains: q.replace(/^#/, "") } }];
    if (phone) or.push({ customer: { phone } });
    else if (digits.length >= 4) or.push({ customer: { phone: { contains: digits } } });
    where.OR = or;
    delete where.createdAt; // la búsqueda cubre todas las fechas
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { customer: { select: { phone: true } }, notifications: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-4 text-2xl font-bold">Historial</h1>

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-200 p-1">
          {RANGES.map((r) => (
            <Link key={r.key} href={`/history?range=${r.key}`} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold ${!q && range === r.key ? "bg-white shadow" : "text-slate-600"}`}>
              {r.label}
            </Link>
          ))}
        </div>
        <form className="flex gap-2" action="/history">
          <input type="hidden" name="range" value={range} />
          <input name="q" defaultValue={q} className="input py-2" placeholder="Buscar # pedido o teléfono" />
          <button className="btn-secondary">Buscar</button>
          {q && <Link href={`/history?range=${range}`} className="btn-secondary">✕</Link>}
        </form>
      </div>

      {orders.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">No hay pedidos {q ? "que coincidan con la búsqueda" : "en este periodo"}.</div>
      ) : (
        <>
          {/* Móvil: tarjetas */}
          <div className="space-y-3 md:hidden">
            {orders.map((o) => {
              const n = o.notifications[0];
              const total = minutesBetween(o.createdAt, o.readyAt);
              return (
                <div key={o.id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-extrabold">#{o.orderNumber}</p>
                    <span className={`badge ${STATUS_TONE[o.status as OrderStatus]}`}>{STATUS_LABEL[o.status as OrderStatus]}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{maskPhone(o.customer?.phone)} · {formatDate(o.createdAt, tz)} {formatTime(o.createdAt, tz)}{total !== null && ` · ${total} min`}</p>
                  <p className="mt-1 text-sm">{n ? <NotifResult channel={n.channel} status={n.status} error={n.errorMessage} /> : <span className="text-slate-400">Sin notificación</span>}</p>
                </div>
              );
            })}
          </div>

          {/* Escritorio: tabla */}
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Pedido</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3">Registro</th>
                  <th className="px-4 py-3">Preparación</th>
                  <th className="px-4 py-3">Listo</th>
                  <th className="px-4 py-3">Entrega</th>
                  <th className="px-4 py-3">Espera</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Notificación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => {
                  const n = o.notifications[0];
                  const total = minutesBetween(o.createdAt, o.readyAt);
                  return (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-base font-bold">#{o.orderNumber}{o.source !== "MANUAL" && <span className="ml-2 text-xs font-normal text-slate-400">{o.source}</span>}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{maskPhone(o.customer?.phone)}</td>
                      <td className="px-4 py-3 tabular-nums">{range !== "today" || q ? `${formatDate(o.createdAt, tz)} ` : ""}{formatTime(o.createdAt, tz)}</td>
                      <td className="px-4 py-3 tabular-nums">{formatTime(o.preparingAt, tz)}</td>
                      <td className="px-4 py-3 tabular-nums">{formatTime(o.readyAt, tz)}</td>
                      <td className="px-4 py-3 tabular-nums">{formatTime(o.deliveredAt ?? o.cancelledAt, tz)}</td>
                      <td className="px-4 py-3 tabular-nums">{total === null ? "—" : `${total} min`}</td>
                      <td className="px-4 py-3"><span className={`badge ${STATUS_TONE[o.status as OrderStatus]}`}>{STATUS_LABEL[o.status as OrderStatus]}</span></td>
                      <td className="px-4 py-3">{n ? <NotifResult channel={n.channel} status={n.status} error={n.errorMessage} /> : <span className="text-slate-400">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {orders.length === 200 && <p className="mt-3 text-center text-sm text-slate-500">Mostrando los 200 más recientes.</p>}
        </>
      )}
    </div>
  );
}

function NotifResult({ channel, status, error }: { channel: string; status: string; error: string | null }) {
  const ok = status === "SENT" || status === "DELIVERED";
  return (
    <span className={ok ? "text-emerald-700" : status === "FAILED" ? "text-red-600" : "text-slate-500"} title={error ?? undefined}>
      {channel} {ok ? "✓" : status === "FAILED" ? "✗" : "…"}
    </span>
  );
}
