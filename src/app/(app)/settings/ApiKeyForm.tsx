"use client";

import { useActionState, useState } from "react";
import { createApiKeyAction, type ApiKeyState } from "@/lib/actions/settings";
import { FormMessage, SubmitButton } from "@/components/ui";

export function ApiKeyForm() {
  const [state, action] = useActionState<ApiKeyState, FormData>(createApiKeyAction, undefined);
  const [copied, setCopied] = useState(false);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="key-name">Nombre</label>
          <input id="key-name" name="name" className="input" placeholder="Ej. WhatsOrder producción" required />
        </div>
        <div>
          <label className="label" htmlFor="key-source">Origen de los pedidos</label>
          <select id="key-source" name="source" className="input" defaultValue="API">
            <option value="API">API</option>
            <option value="WHATSORDER">WhatsOrder</option>
            <option value="POS">POS</option>
            <option value="BILLING">Facturación</option>
          </select>
        </div>
        <SubmitButton pendingText="Creando…">Crear API key</SubmitButton>
      </div>
      <FormMessage state={state} />
      {state?.key && (
        <div className="flex items-center gap-2 rounded-xl bg-slate-900 p-3">
          <code className="flex-1 break-all text-sm text-emerald-300">{state.key}</code>
          <button type="button" className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white" onClick={() => { navigator.clipboard.writeText(state.key!); setCopied(true); }}>
            {copied ? "Copiada" : "Copiar"}
          </button>
        </div>
      )}
    </form>
  );
}
