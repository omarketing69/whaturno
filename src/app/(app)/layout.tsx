import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { logout } from "@/lib/actions/auth";
import { ROLE_LABEL } from "@/lib/constants";
import { AppNav } from "@/components/AppNav";
import { Logo } from "@/components/Logo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const business = await prisma.business.findUniqueOrThrow({ where: { id: user.businessId }, select: { name: true } });

  return (
    <div className="min-h-full lg:flex">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-4 lg:flex lg:sticky lg:top-0 lg:h-screen">
        <Logo className="mb-1 px-2 text-lg" />
        <p className="mb-6 truncate px-2 text-sm text-slate-500">{business.name}</p>
        <AppNav role={user.role} variant="side" />
        <div className="mt-auto border-t border-slate-100 pt-4">
          <p className="truncate px-2 text-sm font-medium">{user.name}</p>
          <p className="px-2 text-xs text-slate-500">{ROLE_LABEL[user.role]}</p>
          <form action={logout}>
            <button className="mt-2 w-full rounded-lg px-2 py-1.5 text-left text-sm text-slate-500 hover:bg-slate-100">Cerrar sesión</button>
          </form>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="min-w-0">
          <Logo className="text-base" />
          <p className="truncate text-xs text-slate-500">{business.name} · {user.name}</p>
        </div>
        <form action={logout}>
          <button className="text-sm text-slate-500">Salir</button>
        </form>
      </header>

      <main className="min-w-0 flex-1 px-4 pb-24 pt-5 sm:px-6 lg:px-10 lg:pb-10 lg:pt-8">{children}</main>
      <AppNav role={user.role} variant="bottom" />
    </div>
  );
}
