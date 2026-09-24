"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "../db";
import { verifyPassword } from "../auth/password";
import { createPlatformSession, destroyPlatformSession, requirePlatformAdmin } from "../auth/platform";
import { rateLimit } from "../rateLimit";
import { requestIp } from "../request";
import { audit } from "../audit";
import { adjustCredits, changePlan, topUpCredits } from "@/domain/billing/credits";
import { DomainError } from "@/domain/errors";
import type { FormState } from "./types";

export async function platformLogin(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const ip = await requestIp();
  if (!rateLimit(`plogin:${ip}`, 10, 900_000).ok || !rateLimit(`plogin:${email}`, 5, 900_000).ok) {
    return { error: "Demasiados intentos. Espera unos minutos." };
  }
  const admin = await prisma.platformAdmin.findUnique({ where: { email } });
  if (!admin || !admin.active || !(await verifyPassword(password.slice(0, 200), admin.passwordHash))) {
    return { error: "Correo o contraseña incorrectos" };
  }
  await createPlatformSession(admin.id);
  redirect("/admin");
}

export async function platformLogout() {
  await destroyPlatformSession();
  redirect("/admin/login");
}

async function guard<T>(fn: () => Promise<T>): Promise<T | FormState> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof DomainError) return { error: err.message };
    throw err;
  }
}

async function log(adminId: string, businessId: string, action: string, metadata?: Record<string, unknown>) {
  await audit({ businessId, actor: `platform:${adminId}`, action, metadata, ip: await requestIp() });
}

const idSchema = z.string().min(1).max(40);

// ── Negocios ──

const topUpSchema = z.object({
  businessId: idSchema,
  amount: z.coerce.number().int("Debe ser un número entero").min(1, "Mínimo 1").max(1_000_000),
  note: z.string().trim().max(200).optional(),
});

export async function topUpAction(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requirePlatformAdmin();
  const parsed = topUpSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { businessId, amount, note } = parsed.data;
  return guard(async () => {
    await topUpCredits(prisma, businessId, amount, `platform:${admin.id}`, note || "Recarga manual");
    await log(admin.id, businessId, "credits.topup", { amount });
    revalidatePath(`/admin/businesses/${businessId}`);
    return { ok: true, message: `Se agregaron ${amount.toLocaleString("es-CO")} créditos` };
  });
}

const adjustSchema = z.object({
  businessId: idSchema,
  bucket: z.enum(["INCLUDED", "EXTRA"]),
  amount: z.coerce.number().int("Debe ser un número entero"),
  note: z.string().trim().min(3, "Explica el motivo del ajuste").max(200),
});

export async function adjustAction(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requirePlatformAdmin();
  const parsed = adjustSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { businessId, bucket, amount, note } = parsed.data;
  return guard(async () => {
    await adjustCredits(prisma, businessId, bucket, amount, `platform:${admin.id}`, note);
    await log(admin.id, businessId, "credits.adjusted", { bucket, amount, note });
    revalidatePath(`/admin/businesses/${businessId}`);
    return { ok: true, message: "Ajuste aplicado" };
  });
}

export async function changePlanAction(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requirePlatformAdmin();
  const businessId = idSchema.parse(form.get("businessId"));
  const planId = String(form.get("planId") ?? "") || null;
  return guard(async () => {
    await changePlan(prisma, businessId, planId, `platform:${admin.id}`);
    await log(admin.id, businessId, "subscription.plan_changed", { planId });
    revalidatePath(`/admin/businesses/${businessId}`);
    return { ok: true, message: "Plan actualizado" };
  });
}

export async function setBusinessStatus(businessId: string, status: "ACTIVE" | "SUSPENDED") {
  const admin = await requirePlatformAdmin();
  idSchema.parse(businessId);
  await prisma.business.update({ where: { id: businessId }, data: { status } });
  await log(admin.id, businessId, status === "SUSPENDED" ? "subscription.suspended" : "subscription.activated");
  revalidatePath(`/admin/businesses/${businessId}`);
  revalidatePath("/admin");
}

// ── Solicitudes de recarga ──

export async function resolveCreditRequest(requestId: string, approve: boolean) {
  const admin = await requirePlatformAdmin();
  idSchema.parse(requestId);
  await prisma.$transaction(async (tx) => {
    // Solo se resuelve si sigue pendiente (evita aprobar dos veces)
    const { count } = await tx.creditRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: { status: approve ? "APPROVED" : "REJECTED", resolvedBy: admin.id, resolvedAt: new Date() },
    });
    if (!count) return;
    const request = await tx.creditRequest.findUniqueOrThrow({ where: { id: requestId } });
    if (approve) await topUpCredits(tx, request.businessId, request.amount, `platform:${admin.id}`, `Solicitud de recarga aprobada`);
    await tx.auditLog.create({
      data: { businessId: request.businessId, actor: `platform:${admin.id}`, action: approve ? "credits.request_approved" : "credits.request_rejected", entityType: "creditRequest", entityId: request.id, metadata: JSON.stringify({ amount: request.amount }) },
    });
  });
  revalidatePath("/admin/requests");
  revalidatePath("/admin");
}

// ── Planes ──

const planSchema = z.object({
  id: z.string().max(40).optional(),
  name: z.string().trim().min(2, "Nombre obligatorio").max(40),
  monthlySmsCredits: z.coerce.number().int().min(0, "No puede ser negativo").max(1_000_000),
  priceMonthly: z.coerce.number().int().min(0).max(1_000_000_000),
  isDefault: z.literal("on").optional().transform((v) => v === "on"),
  active: z.literal("on").optional().transform((v) => v === "on"),
});

export async function savePlan(_: FormState, form: FormData): Promise<FormState> {
  await requirePlatformAdmin();
  const parsed = planSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, ...data } = parsed.data;
  if (data.isDefault && !data.active) return { error: "El plan por defecto debe estar activo" };
  await prisma.$transaction(async (tx) => {
    if (data.isDefault) await tx.plan.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    if (id) await tx.plan.update({ where: { id }, data });
    else await tx.plan.create({ data });
  });
  revalidatePath("/admin/plans");
  return { ok: true, message: id ? "Plan actualizado (aplica desde el próximo mes)" : "Plan creado" };
}
