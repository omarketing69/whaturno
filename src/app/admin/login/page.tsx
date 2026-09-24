"use client";

import { useActionState } from "react";
import { platformLogin } from "@/lib/actions/platform";
import { FormMessage, SubmitButton } from "@/components/ui";
import { Logo } from "@/components/Logo";

export default function PlatformLoginPage() {
  const [state, action] = useActionState(platformLogin, undefined);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-4">
      <Logo className="mb-2 text-xl text-white" />
      <p className="mb-8 text-sm font-semibold uppercase tracking-widest text-slate-400">Plataforma</p>
      <form action={action} className="card w-full max-w-sm space-y-4 p-6">
        <h1 className="text-xl font-bold">Acceso de superadmin</h1>
        <div>
          <label className="label" htmlFor="email">Correo</label>
          <input className="input" id="email" name="email" type="email" required autoFocus autoComplete="username" />
        </div>
        <div>
          <label className="label" htmlFor="password">Contraseña</label>
          <input className="input" id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <FormMessage state={state} />
        <SubmitButton className="btn-primary w-full" pendingText="Entrando…">Entrar</SubmitButton>
      </form>
    </main>
  );
}
