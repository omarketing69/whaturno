import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { savePlan } from "@/lib/actions/platform";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/ui";

export const metadata = { title: "Planes" };

function PlanFields({ plan }: { plan?: { id: string; name: string; monthlySmsCredits: number; priceMonthly: number; isDefault: boolean; active: boolean } }) {
  return (
    <>
      {plan && <input type="hidden" name="id" value={plan.id} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className="label">Nombre</label><input name="name" required defaultValue={plan?.name} className="input" /></div>
        <div><label className="label">SMS incluidos / mes</label><input name="monthlySmsCredits" type="number" min={0} required defaultValue={plan?.monthlySmsCredits} className="input" /></div>
        <div><label className="label">Precio mensual</label><input name="priceMonthly" type="number" min={0} defaultValue={plan?.priceMonthly ?? 0} className="input" /></div>
      </div>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={plan?.active ?? true} className="h-4 w-4 accent-brand-600" /> Activo</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="isDefault" defaultChecked={plan?.isDefault} className="h-4 w-4 accent-brand-600" /> Plan por defecto al registrarse</label>
      </div>
    </>
  );
}

export default async function PlansPage() {
  await requirePlatformAdmin();
  const plans = await prisma.plan.findMany({ orderBy: { monthlySmsCredits: "asc" }, include: { _count: { select: { businesses: true } } } });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Planes</h1>
        <p className="text-sm text-slate-500">Los SMS incluidos se asignan cada mes calendario y los que sobran vencen. Las recargas son créditos adicionales que no vencen.</p>
      </div>
      {plans.map((p) => (
        <section key={p.id} className="card p-5">
          <p className="mb-3 text-sm text-slate-500">{p._count.businesses} negocios en este plan{p.isDefault && " · por defecto"}</p>
          <ActionForm action={savePlan}>
            <PlanFields plan={p} />
            <SubmitButton className="btn-secondary">Guardar</SubmitButton>
          </ActionForm>
        </section>
      ))}
      <section className="card border-dashed p-5">
        <h2 className="mb-3 font-bold">Nuevo plan</h2>
        <ActionForm action={savePlan}>
          <PlanFields />
          <SubmitButton>Crear plan</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
