import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { platformLogout } from "@/lib/actions/platform";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: { default: "Plataforma", template: "%s · Plataforma Digiturno" }, robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin();
  const pending = await prisma.creditRequest.count({ where: { status: "PENDING" } });
  const links = [
    { href: "/admin", label: "Negocios" },
    { href: "/admin/requests", label: "Solicitudes", badge: pending },
    { href: "/admin/plans", label: "Planes" },
  ];
  return (
    <div className="min-h-screen">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2">
            <Logo className="text-base" />
            <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-900">Superadmin</span>
          </Link>
          <nav className="flex flex-1 gap-1">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white">
                {l.label}
                {!!l.badge && <span className="rounded-full bg-amber-400 px-1.5 text-xs font-bold text-slate-900">{l.badge}</span>}
              </Link>
            ))}
          </nav>
          <form action={platformLogout} className="flex items-center gap-3 text-sm text-slate-400">
            <span className="hidden sm:inline">{admin.name}</span>
            <button className="hover:text-white">Salir</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
