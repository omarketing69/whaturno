import { Logo } from "@/components/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-full flex-col items-center justify-center px-4 py-10">
      <Logo className="mb-8 text-xl" />
      <div className="card w-full max-w-md p-6 sm:p-8">{children}</div>
      <p className="mt-6 max-w-sm text-center text-sm text-slate-500">
        Avisa a tus clientes cuando su pedido esté listo.
      </p>
    </main>
  );
}
