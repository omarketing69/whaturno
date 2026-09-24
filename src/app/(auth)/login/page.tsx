"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/lib/actions/auth";
import { FormMessage, SubmitButton } from "@/components/ui";

export default function LoginPage() {
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <h1 className="text-2xl font-bold">Iniciar sesión</h1>
      <div>
        <label className="label" htmlFor="email">Correo</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </div>
      <div>
        <label className="label" htmlFor="password">Contraseña</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full py-3" pendingText="Entrando…">Entrar</SubmitButton>
      <p className="text-center text-sm text-slate-600">
        ¿Nuevo en Digiturno? <Link className="font-semibold text-brand-600" href="/signup">Crea tu cuenta</Link>
      </p>
    </form>
  );
}
