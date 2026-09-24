import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { appUrl, displayUrl } from "@/lib/config";
import { ROLE_LABEL, SOURCE_LABEL, type OrderSource, type Role } from "@/lib/constants";
import { formatDate } from "@/lib/time";
import { getCreditSummary } from "@/domain/billing/credits";
import { TX_LABEL } from "@/domain/billing/overview";
import { INTEGRATIONS } from "@/domain/ecosystem";
import { TEMPLATE_VARIABLES } from "@/domain/notifications/template";
import {
  createUser,
  regenerateDisplayToken,
  revokeApiKey,
  requestCredits,
  sendTestSms,
  toggleUserActive,
  updateBusiness,
  updateNotifications,
  updateOrderSettings,
} from "@/lib/actions/settings";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/ui";
import { ApiKeyForm } from "./ApiKeyForm";
import { ConfirmButton } from "@/components/ConfirmButton";

export const metadata: Metadata = { title: "Configuración" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "negocio", label: "Negocio" },
  { key: "pedidos", label: "Pedidos" },
  { key: "notificaciones", label: "Notificaciones" },
  { key: "plan", label: "Plan y créditos" },
  { key: "usuarios", label: "Usuarios" },
  { key: "pantalla", label: "Pantalla pública" },
  { key: "integraciones", label: "Integraciones" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const COUNTRIES = [
  ["CO", "Colombia (+57)"], ["MX", "México (+52)"], ["PE", "Perú (+51)"], ["EC", "Ecuador (+593)"], ["CL", "Chile (+56)"],
  ["AR", "Argentina (+54)"], ["VE", "Venezuela (+58)"], ["PA", "Panamá (+507)"], ["CR", "Costa Rica (+506)"],
  ["DO", "Rep. Dominicana (+1)"], ["GT", "Guatemala (+502)"], ["ES", "España (+34)"], ["US", "Estados Unidos (+1)"],
];
const TIMEZONES = ["America/Bogota", "America/Mexico_City", "America/Lima", "America/Guayaquil", "America/Santiago", "America/Argentina/Buenos_Aires", "America/Caracas", "America/Panama", "America/Costa_Rica", "America/Santo_Domingo", "America/Guatemala", "Europe/Madrid", "America/New_York", "America/Los_Angeles"];

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-lg font-bold">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Toggle({ name, label, hint, defaultChecked, disabled }: { name: string; label: string; hint?: string; defaultChecked?: boolean; disabled?: boolean }) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? "opacity-50" : ""}`}>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} disabled={disabled} className="mt-0.5 h-5 w-5 accent-brand-600" />
      <span>
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-sm text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser(["ADMIN"]);
  const requested = (await searchParams).tab;
  const tab: Tab = TABS.some((t) => t.key === requested) ? (requested as Tab) : "negocio";
  const b = await prisma.business.findUniqueOrThrow({ where: { id: user.businessId } });

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-4 text-2xl font-bold">Configuración</h1>
      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <Link key={t.key} href={`/settings?tab=${t.key}`} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${tab === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="space-y-6">
        {tab === "negocio" && (
          <Section title="Negocio" description="Aparece en la pantalla pública, el seguimiento y los mensajes.">
            <ActionForm action={updateBusiness}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2"><label className="label" htmlFor="name">Nombre</label><input id="name" name="name" className="input" defaultValue={b.name} required /></div>
                <div className="sm:col-span-2"><label className="label" htmlFor="logoUrl">URL del logo</label><input id="logoUrl" name="logoUrl" type="url" className="input" defaultValue={b.logoUrl ?? ""} placeholder="https://…/logo.png" /></div>
                <div><label className="label" htmlFor="phone">Teléfono</label><input id="phone" name="phone" className="input" defaultValue={b.phone ?? ""} /></div>
                <div><label className="label" htmlFor="address">Dirección</label><input id="address" name="address" className="input" defaultValue={b.address ?? ""} /></div>
                <div>
                  <label className="label" htmlFor="country">País (para los celulares)</label>
                  <select id="country" name="country" className="input" defaultValue={b.country}>{COUNTRIES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</select>
                </div>
                <div>
                  <label className="label" htmlFor="timezone">Zona horaria</label>
                  <select id="timezone" name="timezone" className="input" defaultValue={b.timezone}>{TIMEZONES.map((z) => <option key={z}>{z}</option>)}</select>
                </div>
                <div>
                  <label className="label" htmlFor="brandColor">Color de marca</label>
                  <input id="brandColor" name="brandColor" type="color" className="h-11 w-24 cursor-pointer rounded-xl border border-slate-300 p-1" defaultValue={b.brandColor} />
                </div>
              </div>
              <SubmitButton>Guardar</SubmitButton>
            </ActionForm>
          </Section>
        )}

        {tab === "pedidos" && (
          <Section title="Pedidos" description="Cómo se numeran los pedidos registrados manualmente.">
            <ActionForm action={updateOrderSettings}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="label" htmlFor="orderPrefix">Prefijo</label><input id="orderPrefix" name="orderPrefix" className="input uppercase" maxLength={4} defaultValue={b.orderPrefix} placeholder="Ej. A" /></div>
                <div>
                  <label className="label" htmlFor="numberingMode">Numeración</label>
                  <select id="numberingMode" name="numberingMode" className="input" defaultValue={b.numberingMode}>
                    <option value="MANUAL">Manual — el cajero escribe el número (del POS o ticket)</option>
                    <option value="AUTO">Automática — Digiturno asigna 1, 2, 3…</option>
                  </select>
                </div>
              </div>
              <Toggle name="dailyReset" label="Reiniciar la numeración automática cada día" defaultChecked={b.dailyReset} />
              <Toggle name="requirePhone" label="Celular obligatorio para avisar al cliente" hint="Modo notificación activo. Recomendado." defaultChecked={b.requirePhone} />
              <SubmitButton>Guardar</SubmitButton>
            </ActionForm>
          </Section>
        )}

        {tab === "notificaciones" && (
          <>
            <Section title="Canales" description="SMS es el canal principal: funciona en cualquier celular.">
              <ActionForm action={updateNotifications}>
                <Toggle name="smsEnabled" label="SMS" hint="Cada mensaje consume 1 crédito de tu plan." defaultChecked={b.smsEnabled} />
                <Toggle name="telegramEnabled" label="Telegram (opcional)" hint="Solo para clientes que inicien el bot desde su link de seguimiento. Si falla, se usa SMS." defaultChecked={b.telegramEnabled} />
                <Toggle name="whatsappEnabled" label="WhatsApp — Próximamente" disabled />
                <div>
                  <label className="label" htmlFor="smsTemplate">Mensaje cuando el pedido está listo</label>
                  <textarea id="smsTemplate" name="smsTemplate" rows={3} maxLength={320} className="input" defaultValue={b.smsTemplate} />
                  <p className="mt-1 text-xs text-slate-500">Variables: {TEMPLATE_VARIABLES.join(" ")}</p>
                </div>
                <SubmitButton>Guardar</SubmitButton>
              </ActionForm>
            </Section>
            <Section title="Probar SMS" description="Envía el mensaje con datos de ejemplo. Consume 1 crédito.">
              <ActionForm action={sendTestSms} className="space-y-3">
                <div className="flex gap-2">
                  <input name="phone" type="tel" className="input" placeholder="315 555 1234" required />
                  <SubmitButton className="btn-secondary whitespace-nowrap" pendingText="Enviando…">Enviar prueba</SubmitButton>
                </div>
              </ActionForm>
            </Section>
          </>
        )}

        {tab === "plan" && <PlanTab businessId={b.id} />}

        {tab === "usuarios" && <UsersTab businessId={b.id} currentUserId={user.id} />}

        {tab === "pantalla" && (
          <Section title="Pantalla pública" description="Ábrela en un TV, monitor o tablet. No requiere iniciar sesión y solo muestra números de pedidos listos.">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <code className="flex-1 break-all rounded-xl bg-slate-100 px-3 py-2.5 text-sm">{displayUrl(b.id, b.displayToken)}</code>
              <a href={displayUrl(b.id, b.displayToken)} target="_blank" rel="noreferrer" className="btn-primary">Abrir</a>
            </div>
            <form action={regenerateDisplayToken} className="mt-5 border-t border-slate-100 pt-5">
              <p className="mb-3 text-sm text-slate-500">¿Se filtró el enlace? Genera uno nuevo: el anterior dejará de funcionar.</p>
              <ConfirmButton message="El enlace actual dejará de funcionar. ¿Continuar?" className="btn-danger">Generar nuevo enlace</ConfirmButton>
            </form>
          </Section>
        )}

        {tab === "integraciones" && <IntegrationsTab businessId={b.id} />}
      </div>
    </div>
  );
}

async function UsersTab({ businessId, currentUserId }: { businessId: string; currentUserId: string }) {
  const users = await prisma.user.findMany({ where: { businessId }, orderBy: { createdAt: "asc" } });
  return (
    <>
      <Section title="Usuarios" description="Administrador: todo. Cajero: registrar pedidos, cocina e historial. Cocina: solo la pantalla de cocina.">
        <ul className="divide-y divide-slate-100">
          {users.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className={`truncate font-medium ${u.active ? "" : "text-slate-400 line-through"}`}>{u.name}</p>
                <p className="truncate text-sm text-slate-500">{u.email} · {ROLE_LABEL[u.role as Role]}</p>
              </div>
              {u.id !== currentUserId && (
                <form action={toggleUserActive.bind(null, u.id)}>
                  <button className={u.active ? "btn-secondary py-1.5 text-sm" : "btn-primary py-1.5 text-sm"}>{u.active ? "Desactivar" : "Activar"}</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Nuevo usuario">
        <ActionForm action={createUser}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="u-name">Nombre</label><input id="u-name" name="name" className="input" required /></div>
            <div><label className="label" htmlFor="u-email">Correo</label><input id="u-email" name="email" type="email" className="input" required /></div>
            <div><label className="label" htmlFor="u-password">Contraseña</label><input id="u-password" name="password" type="password" minLength={8} className="input" required autoComplete="new-password" /></div>
            <div>
              <label className="label" htmlFor="u-role">Rol</label>
              <select id="u-role" name="role" className="input" defaultValue="CASHIER">
                <option value="CASHIER">Cajero</option>
                <option value="KITCHEN">Cocina</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
          </div>
          <SubmitButton>Crear usuario</SubmitButton>
        </ActionForm>
      </Section>
    </>
  );
}

async function IntegrationsTab({ businessId }: { businessId: string }) {
  const keys = await prisma.apiKey.findMany({ where: { businessId }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <Section title="Integraciones" description="Digiturno no reemplaza tu POS: solo recibe el número del pedido y el celular del cliente.">
        <div className="grid gap-3 sm:grid-cols-2">
          {INTEGRATIONS.map((i) => (
            <div key={i.key} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{i.name}</p>
                <span className={`badge ${i.status === "AVAILABLE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>{i.status === "AVAILABLE" ? "Vía API" : "Próximamente"}</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">{i.description}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="API keys" description="Para que un sistema externo cree pedidos y los marque como listos.">
        <ApiKeyForm />
        {keys.length > 0 && (
          <ul className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className={`font-medium ${k.revokedAt ? "text-slate-400 line-through" : ""}`}>{k.name} <span className="text-sm font-normal text-slate-500">· {SOURCE_LABEL[k.source as OrderSource]}</span></p>
                  <p className="font-mono text-xs text-slate-500">{k.prefix}… · creada {formatDate(k.createdAt, "UTC")}{k.lastUsedAt && ` · último uso ${formatDate(k.lastUsedAt, "UTC")}`}</p>
                </div>
                {!k.revokedAt && (
                  <form action={revokeApiKey.bind(null, k.id)}>
                    <ConfirmButton message="Los sistemas que usen esta key dejarán de funcionar. ¿Revocar?" className="btn-danger py-1.5 text-sm">Revocar</ConfirmButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Uso rápido de la API">
        <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">{`# Crear pedido
curl -X POST ${appUrl()}/api/v1/orders \\
  -H "Authorization: Bearer dt_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"external_order_id":"583","customer":{"phone":"+573155551234","name":"Juan"},"status":"PREPARING"}'

# Marcar como listo (envía la notificación)
curl -X PATCH ${appUrl()}/api/v1/orders/{id} \\
  -H "Authorization: Bearer dt_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"status":"READY"}'`}</pre>
        <p className="mt-2 text-sm text-slate-500">Documentación completa en <code>docs/API.md</code>.</p>
      </Section>
    </>
  );
}

async function PlanTab({ businessId }: { businessId: string }) {
  const [c, requests, movements] = await Promise.all([
    getCreditSummary(prisma, businessId),
    prisma.creditRequest.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.smsCreditTransaction.findMany({ where: { businessId, type: { notIn: ["USAGE", "REFUND"] } }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const planTotal = c.plan?.monthlySmsCredits ?? 0;
  const pct = planTotal ? Math.min(100, Math.round((c.includedRemaining / planTotal) * 100)) : 0;
  return (
    <>
      <Section title={c.plan ? `Plan ${c.plan.name}` : "Sin plan asignado"} description="Primero se usan los SMS incluidos del mes; cuando se acaban, los adicionales. Los adicionales no vencen.">
        {c.low && (
          <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Te quedan pocos SMS. Cuando se acaben, los pedidos seguirán funcionando pero los clientes no recibirán el aviso por SMS.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-slate-500">Incluidos este mes</p>
            <p className="text-3xl font-extrabold tabular-nums">{c.includedRemaining.toLocaleString("es-CO")}<span className="text-base font-medium text-slate-400"> / {planTotal.toLocaleString("es-CO")}</span></p>
            <div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${pct}%` }} /></div>
          </div>
          <div>
            <p className="text-sm text-slate-500">Adicionales</p>
            <p className="text-3xl font-extrabold tabular-nums">{c.extraBalance.toLocaleString("es-CO")}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Usados este mes</p>
            <p className="text-3xl font-extrabold tabular-nums">{c.usedThisPeriod.toLocaleString("es-CO")}</p>
          </div>
        </div>
      </Section>

      <Section title="Solicitar recarga" description="Pide más SMS. Te confirmaremos el pago y los créditos se acreditarán a tu cuenta.">
        <ActionForm action={requestCredits}>
          <div className="grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
            <div>
              <label className="label" htmlFor="amount">Cantidad de SMS</label>
              <select id="amount" name="amount" className="input" defaultValue="1000">
                {[500, 1000, 2000, 5000, 10000].map((n) => <option key={n} value={n}>{n.toLocaleString("es-CO")}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="note">Nota (opcional)</label>
              <input id="note" name="note" maxLength={200} className="input" placeholder="Ej. referencia de la transferencia" />
            </div>
            <SubmitButton pendingText="Enviando…">Solicitar</SubmitButton>
          </div>
        </ActionForm>
        {requests.length > 0 && (
          <ul className="mt-5 divide-y divide-slate-100 border-t border-slate-100 text-sm">
            {requests.map((r) => (
              <li key={r.id} className="flex justify-between py-2.5">
                <span>{r.amount.toLocaleString("es-CO")} SMS · {formatDate(r.createdAt, "America/Bogota")}</span>
                <span className={`badge ${r.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" : r.status === "PENDING" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500"}`}>
                  {r.status === "APPROVED" ? "Acreditada" : r.status === "PENDING" ? "Pendiente" : "Rechazada"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {movements.length > 0 && (
        <Section title="Movimientos">
          <ul className="divide-y divide-slate-100 text-sm">
            {movements.map((t) => (
              <li key={t.id} className="flex justify-between py-2.5">
                <span>{TX_LABEL[t.type] ?? t.type} <span className="text-slate-400">· {formatDate(t.createdAt, "America/Bogota")}</span></span>
                <span className={`font-semibold tabular-nums ${t.amount > 0 ? "text-emerald-700" : "text-red-600"}`}>{t.amount > 0 ? "+" : ""}{t.amount.toLocaleString("es-CO")}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
