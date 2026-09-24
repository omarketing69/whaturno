"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/constants";

const ITEMS: { href: string; label: string; icon: string; roles: Role[] }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "M3 12l9-9 9 9M5 10v10h14V10", roles: ["ADMIN"] },
  { href: "/orders/new", label: "Nuevo pedido", icon: "M12 5v14M5 12h14", roles: ["ADMIN", "CASHIER"] },
  { href: "/kitchen", label: "Cocina", icon: "M4 6h4v12H4zM10 6h4v12h-4zM16 6h4v12h-4z", roles: ["ADMIN", "CASHIER", "KITCHEN"] },
  { href: "/history", label: "Historial", icon: "M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z", roles: ["ADMIN", "CASHIER"] },
  { href: "/settings", label: "Configuración", icon: "M10.3 4.3a1.7 1.7 0 013.4 0l.2.9a1.7 1.7 0 002.5 1l.8-.5a1.7 1.7 0 012.4 2.4l-.5.8a1.7 1.7 0 001 2.5l.9.2a1.7 1.7 0 010 3.4l-.9.2a1.7 1.7 0 00-1 2.5l.5.8a1.7 1.7 0 01-2.4 2.4l-.8-.5a1.7 1.7 0 00-2.5 1l-.2.9a1.7 1.7 0 01-3.4 0l-.2-.9a1.7 1.7 0 00-2.5-1l-.8.5a1.7 1.7 0 01-2.4-2.4l.5-.8a1.7 1.7 0 00-1-2.5l-.9-.2a1.7 1.7 0 010-3.4l.9-.2a1.7 1.7 0 001-2.5l-.5-.8a1.7 1.7 0 012.4-2.4l.8.5a1.7 1.7 0 002.5-1zM12 15a3 3 0 100-6 3 3 0 000 6z", roles: ["ADMIN"] },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function AppNav({ role, variant }: { role: Role; variant: "side" | "bottom" }) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => i.roles.includes(role));
  if (items.length < 2 && variant === "bottom") return null;

  if (variant === "bottom") {
    return (
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        {items.map((i) => {
          const active = pathname.startsWith(i.href);
          return (
            <Link key={i.href} href={i.href} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active ? "text-brand-600" : "text-slate-500"}`}>
              <Icon d={i.icon} />
              {i.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="space-y-1">
      {items.map((i) => {
        const active = pathname.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"}`}
          >
            <Icon d={i.icon} />
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
