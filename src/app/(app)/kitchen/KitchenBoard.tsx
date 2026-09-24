"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import type { BoardOrder } from "@/domain/orders/queries";
import { changeStatusAction } from "@/lib/actions/orders";

const COLUMNS = [
  { status: "NEW", title: "Nuevos", action: "Preparar", next: "PREPARING", tone: "bg-slate-100 text-slate-700", button: "bg-amber-500 hover:bg-amber-600" },
  { status: "PREPARING", title: "Preparando", action: "Listo", next: "READY", tone: "bg-amber-100 text-amber-800", button: "bg-emerald-600 hover:bg-emerald-700" },
  { status: "READY", title: "Listos", action: "Entregado", next: "DELIVERED", tone: "bg-emerald-100 text-emerald-800", button: "bg-slate-800 hover:bg-slate-900" },
] as const;

function elapsed(from: string, now: number) {
  const min = Math.max(0, Math.floor((now - new Date(from).getTime()) / 60000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}

export function KitchenBoard({ initial, canCancel }: { initial: BoardOrder[]; canCancel: boolean }) {
  const [orders, setOrders] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState<(typeof COLUMNS)[number]["status"]>("NEW");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/app/board", { cache: "no-store" });
      if (res.status === 401) return window.location.assign("/login");
      if (res.ok) setOrders((await res.json()).orders);
    } catch {
      /* sin conexión: se reintenta en el siguiente ciclo */
    }
  }, []);

  useEffect(() => {
    const poll = setInterval(refresh, 4000);
    const clock = setInterval(() => setNow(Date.now()), 15000);
    return () => { clearInterval(poll); clearInterval(clock); };
  }, [refresh]);

  function move(order: BoardOrder, to: string) {
    setBusy(order.id);
    setError(undefined);
    startTransition(async () => {
      const res = await changeStatusAction(order.id, to);
      if (res.error) setError(`#${order.orderNumber}: ${res.error}`);
      await refresh();
      setBusy(undefined);
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Cocina</h1>
        <span className="text-sm text-slate-500">Se actualiza automáticamente</span>
      </div>
      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-red-700" role="alert">{error}</p>}

      {/* En móvil: pestañas por columna */}
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-slate-200 p-1 md:hidden">
        {COLUMNS.map((c) => (
          <button key={c.status} onClick={() => setTab(c.status)} className={`rounded-lg py-2 text-sm font-semibold ${tab === c.status ? "bg-white shadow" : "text-slate-600"}`}>
            {c.title} ({orders.filter((o) => o.status === c.status).length})
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const list = orders.filter((o) => o.status === col.status);
          return (
            <section key={col.status} className={`${tab === col.status ? "" : "hidden"} rounded-2xl bg-slate-100/70 p-3 md:block`}>
              <header className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-lg font-bold">{col.title}</h2>
                <span className={`badge ${col.tone}`}>{list.length}</span>
              </header>
              <div className="space-y-3">
                {list.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Sin pedidos</p>}
                {list.map((o) => (
                  <article key={o.id} className="card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-4xl font-extrabold leading-none">#{o.orderNumber}</p>
                      <div className="text-right text-sm">
                        <p className="font-semibold text-slate-700">{elapsed(o.createdAt, now)}</p>
                        {o.source !== "MANUAL" && <p className="text-xs text-slate-400">{o.source}</p>}
                      </div>
                    </div>
                    {o.status === "READY" && (
                      <p className="mt-2 text-xs text-slate-500">
                        {o.notification
                          ? `${o.notification.channel} ${o.notification.status === "FAILED" ? "✗ falló" : "✓ enviado"}`
                          : "Sin notificación"}
                      </p>
                    )}
                    <div className="mt-4 flex gap-2">
                      <button
                        disabled={busy === o.id}
                        onClick={() => move(o, col.next)}
                        className={`btn flex-1 py-4 text-lg text-white ${col.button}`}
                      >
                        {busy === o.id ? "…" : col.action}
                      </button>
                      {canCancel && (
                        <button
                          disabled={busy === o.id}
                          onClick={() => confirm(`¿Cancelar el pedido #${o.orderNumber}?`) && move(o, "CANCELLED")}
                          className="btn-secondary px-3 text-slate-400"
                          title="Cancelar pedido"
                          aria-label={`Cancelar pedido ${o.orderNumber}`}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
