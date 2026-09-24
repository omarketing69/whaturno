import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { dateRange } from "@/lib/time";
import { displayUrl } from "@/lib/config";
import { getCreditSummary } from "@/domain/billing/credits";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser(["ADMIN"]);
  const business = await prisma.business.findUniqueOrThrow({ where: { id: user.businessId } });
  const { from } = dateRange("today", business.timezone);
  const businessId = business.id;

  const [pending, preparing, ready, delivered, readyToday, notificationsSent, notificationsFailed] = await Promise.all([
    prisma.order.count({ where: { businessId, status: "NEW" } }),
    prisma.order.count({ where: { businessId, status: "PREPARING" } }),
    prisma.order.count({ where: { businessId, status: "READY" } }),
    prisma.order.count({ where: { businessId, status: "DELIVERED", deliveredAt: { gte: from } } }),
    prisma.order.findMany({ where: { businessId, readyAt: { gte: from } }, select: { createdAt: true, readyAt: true } }),
    prisma.notification.count({ where: { businessId, createdAt: { gte: from }, status: { in: ["SENT", "DELIVERED"] } } }),
    prisma.notification.count({ where: { businessId, createdAt: { gte: from }, status: "FAILED" } }),
  ]);

  const credits = await getCreditSummary(prisma, businessId);
  const avgWait = readyToday.length
    ? Math.round(readyToday.reduce((sum, o) => sum + (o.readyAt!.getTime() - o.createdAt.getTime()), 0) / readyToday.length / 60000)
    : null;

  const stats = [
    { label: "Pendientes", value: pending, hint: "Sin empezar", tone: "text-slate-900" },
    { label: "En preparación", value: preparing, hint: "Ahora mismo", tone: "text-amber-600" },
    { label: "Listos", value: ready, hint: "Esperando al cliente", tone: "text-emerald-600" },
    { label: "Entregados", value: delivered, hint: "Hoy", tone: "text-slate-900" },
    { label: "Tiempo promedio", value: avgWait === null ? "—" : `${avgWait} min`, hint: "Del registro a listo, hoy", tone: "text-slate-900" },
    { label: "Notificaciones", value: notificationsSent, hint: notificationsFailed ? `${notificationsFailed} fallidas hoy` : "Enviadas hoy", tone: "text-slate-900" },
    { label: "SMS disponibles", value: credits.available.toLocaleString("es-CO"), hint: credits.plan ? `Plan ${credits.plan.name}` : "Sin plan", tone: credits.low ? "text-red-600" : "text-slate-900" },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pedidos / Turnos</h1>
          <p className="text-sm text-slate-500">Resumen de hoy</p>
        </div>
        <Link href="/orders/new" className="btn-primary px-6 py-3">+ Nuevo pedido</Link>
      </div>

      {credits.low && (
        <Link href="/settings?tab=plan" className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100">
          <span>{credits.available === 0 ? "Te quedaste sin SMS: los clientes no recibirán el aviso." : `Te quedan ${credits.available} SMS.`}</span>
          <strong className="whitespace-nowrap">Solicitar recarga →</strong>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <p className="text-sm font-medium text-slate-500">{s.label}</p>
            <p className={`mt-1 text-4xl font-extrabold tabular-nums ${s.tone}`}>{s.value}</p>
            <p className={`mt-1 text-xs ${s.label === "Notificaciones" && notificationsFailed ? "text-red-600" : "text-slate-400"}`}>{s.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link href="/kitchen" className="card flex items-center justify-between p-5 hover:border-brand-500">
          <span><strong>Cocina</strong><br /><span className="text-sm text-slate-500">Cambia estados de los pedidos</span></span>
          <span aria-hidden>→</span>
        </Link>
        <a href={displayUrl(business.id, business.displayToken)} target="_blank" rel="noreferrer" className="card flex items-center justify-between p-5 hover:border-brand-500">
          <span><strong>Pantalla pública</strong><br /><span className="text-sm text-slate-500">Ábrela en tu TV o tablet</span></span>
          <span aria-hidden>↗</span>
        </a>
      </div>
    </div>
  );
}
