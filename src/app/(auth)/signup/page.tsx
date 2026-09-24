"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup } from "@/lib/actions/auth";
import { FormMessage, SubmitButton } from "@/components/ui";

export default function SignupPage() {
  const [state, action] = useActionState(signup, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Crea tu cuenta</h1>
        <p className="mt-1 text-sm text-slate-500">En un minuto estarás registrando pedidos.</p>
      </div>
      <div>
        <label className="label" htmlFor="businessName">Nombre del negocio</label>
        <input className="input" id="businessName" name="businessName" required autoFocus placeholder="Ej. Panadería La Espiga" />
      </div>
      <div>
        <label className="label" htmlFor="name">Tu nombre</label>
        <input className="input" id="name" name="name" required autoComplete="name" />
      </div>
      <div>
        <label className="label" htmlFor="email">Correo</label>
        <input className="input" id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">Contraseña</label>
        <input className="input" id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full py-3" pendingText="Creando…">Crear cuenta</SubmitButton>
      <p className="text-center text-sm text-slate-600">
        ¿Ya tienes cuenta? <Link className="font-semibold text-brand-600" href="/login">Inicia sesión</Link>
      </p>
    </form>
  );
}
