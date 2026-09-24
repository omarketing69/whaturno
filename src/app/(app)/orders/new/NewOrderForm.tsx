"use client";

import { useActionState, useState } from "react";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { createOrderAction, type CreateOrderState } from "@/lib/actions/orders";
import { SubmitButton } from "@/components/ui";

type Props = { autoNumber: boolean; prefix: string; country: string; requirePhone: boolean };

export function NewOrderForm(props: Props) {
  const [state, action] = useActionState<CreateOrderState, FormData>(createOrderAction, undefined);
  const [formKey, setFormKey] = useState(0);
  const [dismissed, setDismissed] = useState<CreateOrderState>(undefined);

  if (state && "success" in state && state !== dismissed) {
    return <Success s={state.success} onNew={() => { setDismissed(state); setFormKey((k) => k + 1); }} />;
  }
  const values = state && "values" in state ? state.values : undefined;
  const error = state && "error" in state ? state.error : undefined;
  return <OrderForm key={formKey} {...props} action={action} error={error} values={values} />;
}

function OrderForm({ autoNumber, prefix, country, requirePhone, action, error, values }: Props & { action: (f: FormData) => void; error?: string; values?: { orderNumber?: string; phone?: string } }) {
  const [phone, setPhone] = useState(values?.phone ?? "");
  const [notify, setNotify] = useState(true);
  const parsed = phone.replace(/\D/g, "").length >= 7 ? parsePhoneNumberFromString(phone, country as CountryCode) : undefined;
  const valid = parsed?.isValid();
  const phoneRequired = requirePhone && notify;

  return (
    <form action={action} className="card space-y-5 p-5 sm:p-7">
      <h1 className="text-2xl font-bold">Nuevo pedido</h1>

      <div>
        <label className="label" htmlFor="orderNumber">Número de pedido</label>
        {autoNumber ? (
          <p className="rounded-xl bg-slate-50 px-3.5 py-3 text-slate-600">Se asignará automáticamente</p>
        ) : (
          <div className="flex items-center rounded-xl border border-slate-300 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100">
            <span className="pl-3.5 text-2xl font-semibold text-slate-400">#{prefix}</span>
            <input
              id="orderNumber"
              name="orderNumber"
              required
              autoFocus
              defaultValue={values?.orderNumber}
              inputMode="text"
              autoComplete="off"
              maxLength={20}
              className="w-full bg-transparent px-2 py-3 text-2xl font-semibold outline-none"
              placeholder="583"
            />
          </div>
        )}
      </div>

      <div>
        <label className="label" htmlFor="phone">Celular del cliente{!phoneRequired && <span className="font-normal text-slate-400"> (opcional)</span>}</label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          required={phoneRequired}
          autoFocus={autoNumber}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="input py-3 text-xl"
          placeholder="315 555 1234"
        />
        <p className={`mt-1.5 min-h-5 text-sm ${phone && !valid && phone.replace(/\D/g, "").length >= 7 ? "text-amber-600" : "text-slate-500"}`}>
          {valid ? `✓ ${parsed!.formatInternational()}` : phone.replace(/\D/g, "").length >= 7 ? "Revisa el número" : "“¿Cuál es su número de celular para avisarle cuando su pedido esté listo?”"}
        </p>
      </div>

      <fieldset className="space-y-3 rounded-xl bg-slate-50 p-4">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="notificationConsent" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="mt-0.5 h-5 w-5 accent-brand-600" />
          <span>Acepto recibir mensajes relacionados con mi pedido.</span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="marketingConsent" className="mt-0.5 h-5 w-5 accent-brand-600" />
          <span>Acepto recibir promociones, novedades y ofertas de este negocio.</span>
        </label>
      </fieldset>

      {error && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">{error}</p>}

      <SubmitButton className="btn-primary w-full py-4 text-lg" pendingText="Registrando…">Registrar pedido</SubmitButton>
    </form>
  );
}

function Success({ s, onNew }: { s: { orderNumber: string; channel: string; trackingUrl: string; qrSvg: string }; onNew: () => void }) {
  return (
    <div className="card space-y-5 p-6 text-center sm:p-8">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-3xl text-emerald-600">✓</div>
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Pedido registrado</p>
        <p className="text-5xl font-extrabold">#{s.orderNumber}</p>
        <p className="mt-2 text-slate-600">Notificación: <strong>{s.channel}</strong></p>
      </div>
      <details className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
        <summary className="cursor-pointer font-medium">QR de seguimiento para el cliente</summary>
        <div className="mx-auto mt-3 w-44 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: s.qrSvg }} />
        <a href={s.trackingUrl} target="_blank" rel="noreferrer" className="mt-2 block break-all text-brand-600">{s.trackingUrl}</a>
      </details>
      <button autoFocus onClick={onNew} className="btn-primary w-full py-4 text-lg">Nuevo pedido</button>
    </div>
  );
}
