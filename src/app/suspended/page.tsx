import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { logout } from "@/lib/actions/auth";
import { Logo } from "@/components/Logo";

export const metadata = { title: "Cuenta suspendida" };

export default async function SuspendedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.businessActive) redirect("/");
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <Logo className="mb-8 text-xl" />
      <div className="card max-w-md p-8">
        <h1 className="text-2xl font-bold">Cuenta suspendida</h1>
        <p className="mt-2 text-slate-600">La cuenta de tu negocio está suspendida temporalmente. Comunícate con Digiturno para reactivarla.</p>
        <form action={logout} className="mt-6"><button className="btn-secondary">Cerrar sesión</button></form>
      </div>
    </main>
  );
}
