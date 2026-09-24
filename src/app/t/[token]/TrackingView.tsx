"use client";

import { useEffect, useState } from "react";
import type { PublicOrderStatus } from "@/domain/public";

const COPY: Record<string, { title: string; body: string; tone: string }> = {
  NEW: { title: "Recibido", body: "Te avisaremos cuando esté listo.", tone: "bg-slate-100 text-slate-700" },
  PREPARING: { title: "Preparando", body: "Te avisaremos cuando esté listo.", tone: "bg-amber-100 text-amber-800" },
  READY: { title: "¡Listo!", body: "Puedes pasar a recogerlo.", tone: "bg-emerald-500 text-white" },
  DELIVERED: { title: "Entregado", body: "¡Gracias por tu compra!", tone: "bg-slate-800 text-white" },
  CANCELLED: { title: "Cancelado", body: "Consulta con el personal del negocio.", tone: "bg-red-100 text-red-700" },
};

const STEPS = ["NEW", "PREPARING", "READY", "DELIVERED"];

export function TrackingView({ token, initial, telegramLink }: { token: string; initial: PublicOrderStatus; telegramLink: string | null }) {
  const [s, setS] = useState(initial);

  useEffect(() => {
    if (s.status === "DELIVERED" || s.status === "CANCELLED") return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/public/track/${token}`, { cache: "no-store" });
        if (res.ok) {
          const next: PublicOrderStatus = await res.json();
          if (next.status === "READY" && s.status !== "READY") navigator.vibrate?.([200, 100, 200]);
          setS(next);
        }
      } catch {
        /* reintenta */
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [token, s.status]);

  const copy = COPY[s.status];
  const step = STEPS.indexOf(s.status);

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-8">
      <div className="flex items-center gap-3">
        {s.business.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.business.logoUrl} alt="" className="h-10 w-10 rounded-lg object-contain" />
        )}
        <p className="text-lg font-bold" style={{ color: s.business.brandColor }}>{s.business.name}</p>
      </div>

      <div className="card mt-6 w-full max-w-sm overflow-hidden text-center">
        <div className="p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Pedido</p>
          <p className="text-6xl font-black">#{s.orderNumber}</p>
        </div>
        <div className={`px-6 py-8 transition-colors ${copy.tone}`}>
          <p className={`text-4xl font-extrabold ${s.status === "READY" ? "animate-new-ready inline-block rounded-2xl px-4" : ""}`}>{copy.title}</p>
          <p className="mt-2 text-lg">{copy.body}</p>
        </div>
        {step >= 0 && (
          <ol className="flex justify-between gap-1 px-6 py-4 text-xs text-slate-500">
            {["Recibido", "Preparando", "Listo", "Entregado"].map((label, i) => (
              <li key={label} className="flex flex-1 flex-col items-center gap-1">
                <span className={`h-2 w-full rounded-full ${i <= step ? "bg-emerald-500" : "bg-slate-200"}`} />
                <span className={i === step ? "font-semibold text-slate-800" : ""}>{label}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {telegramLink && s.status !== "DELIVERED" && s.status !== "CANCELLED" && (
        <a href={telegramLink} className="btn-secondary mt-6" target="_blank" rel="noreferrer">
          Recibir el aviso también por Telegram
        </a>
      )}
      <p className="mt-6 text-center text-xs text-slate-400">Esta página se actualiza sola. No necesitas instalar nada.</p>
    </main>
  );
}
