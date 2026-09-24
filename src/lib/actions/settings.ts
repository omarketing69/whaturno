"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "../db";
import { requireUser } from "../auth/session";
import { hashPassword } from "../auth/password";
import { createApiKey } from "../auth/apiKey";
import { audit } from "../audit";
import { requestIp } from "../request";
import { randomToken } from "../tokens";
import { normalizePhone } from "../phone";
import { ORDER_SOURCES, ROLES } from "../constants";
import { renderTemplate } from "@/domain/notifications/template";
import { notificationService } from "@/domain/notifications/NotificationService";
import type { FormState } from "./types";

async function admin() {
  return requireUser(["ADMIN"]);
}

const checkbox = z.literal("on").optional().transform((v) => v === "on");
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

function fail(err: z.ZodError): FormState {
  return { error: err.issues[0].message };
}

async function log(userId: string, businessId: string, action: string, metadata?: Record<string, unknown>) {
  await audit({ businessId, actor: `user:${userId}`, action, metadata, ip: await requestIp() });
}

const validTimezone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const businessSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio").max(80),
  logoUrl: optionalText(500).refine((v) => !v || /^https:\/\//.test(v), "El logo debe ser una URL https://"),
  phone: optionalText(30),
  address: optionalText(160),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color no válido"),
  country: z.string().regex(/^[A-Z]{2}$/, "País no válido"),
  timezone: z.string().refine(validTimezone, "Zona horaria no válida"),
});

export async function updateBusiness(_: FormState, form: FormData): Promise<FormState> {
  const user = await admin();
  const parsed = businessSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail(parsed.error);
  await prisma.business.update({ where: { id: user.businessId }, data: parsed.data });
  await log(user.id, user.businessId, "settings.business_updated");
  revalidatePath("/", "layout");
  return { ok: true, message: "Datos del negocio guardados" };
}

const ordersSchema = z.object({
  orderPrefix: z.string().trim().max(4, "Máximo 4 caracteres").regex(/^[A-Za-z0-9-]*$/, "Solo letras, números o guion"),
  numberingMode: z.enum(["MANUAL", "AUTO"]),
  dailyReset: checkbox,
  requirePhone: checkbox,
});

export async function updateOrderSettings(_: FormState, form: FormData): Promise<FormState> {
  const user = await admin();
  const parsed = ordersSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail(parsed.error);
  await prisma.business.update({ where: { id: user.businessId }, data: { ...parsed.data, orderPrefix: parsed.data.orderPrefix.toUpperCase() } });
  await log(user.id, user.businessId, "settings.orders_updated", parsed.data);
  revalidatePath("/settings");
  return { ok: true, message: "Configuración de pedidos guardada" };
}

const notificationsSchema = z.object({
  smsEnabled: checkbox,
  telegramEnabled: checkbox,
  smsTemplate: z.string().trim().min(10, "La plantilla es muy corta").max(320, "Máximo 320 caracteres (2 SMS)").refine((t) => t.includes("{order_id}"), "La plantilla debe incluir {order_id}"),
});

export async function updateNotifications(_: FormState, form: FormData): Promise<FormState> {
  const user = await admin();
  const parsed = notificationsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail(parsed.error);
  await prisma.business.update({ where: { id: user.businessId }, data: parsed.data });
  await log(user.id, user.businessId, "settings.notifications_updated", { smsEnabled: parsed.data.smsEnabled, telegramEnabled: parsed.data.telegramEnabled });
  revalidatePath("/settings");
  return { ok: true, message: "Notificaciones guardadas" };
}

export async function sendTestSms(_: FormState, form: FormData): Promise<FormState> {
  const user = await admin();
  const business = await prisma.business.findUniqueOrThrow({ where: { id: user.businessId } });
  const phone = normalizePhone(String(form.get("phone") ?? ""), business.country);
  if (!phone) return { error: "Número no válido" };
  const message = renderTemplate(business.smsTemplate, { order_id: "123", business_name: business.name, customer_name: "Cliente", tracking_url: "" });
  const result = await notificationService().sendBilledSMS(business.id, phone, message);
  await log(user.id, user.businessId, "notifications.test_sms", { ok: result.ok, provider: result.provider });
  return result.ok ? { ok: true, message: `SMS de prueba enviado (${result.provider}). Consumió 1 crédito.` } : { error: `No se pudo enviar: ${result.error}` };
}

const userSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre").max(80),
  email: z.string().trim().toLowerCase().email("Correo no válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(200),
  role: z.enum(ROLES),
});

export async function createUser(_: FormState, form: FormData): Promise<FormState> {
  const user = await admin();
  const parsed = userSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail(parsed.error);
  if (await prisma.user.findUnique({ where: { email: parsed.data.email } })) return { error: "Ya existe un usuario con ese correo" };
  const created = await prisma.user.create({
    data: { businessId: user.businessId, name: parsed.data.name, email: parsed.data.email, role: parsed.data.role, passwordHash: await hashPassword(parsed.data.password) },
  });
  await log(user.id, user.businessId, "user.created", { userId: created.id, role: created.role });
  revalidatePath("/settings");
  return { ok: true, message: `Usuario ${created.name} creado` };
}

export async function toggleUserActive(userId: string) {
  const user = await admin();
  if (userId === user.id) return;
  const target = await prisma.user.findFirst({ where: { id: userId, businessId: user.businessId } });
  if (!target) return;
  await prisma.user.update({ where: { id: target.id }, data: { active: !target.active } });
  if (target.active) await prisma.session.deleteMany({ where: { userId: target.id } });
  await log(user.id, user.businessId, target.active ? "user.deactivated" : "user.activated", { userId: target.id });
  revalidatePath("/settings");
}

export async function regenerateDisplayToken() {
  const user = await admin();
  await prisma.business.update({ where: { id: user.businessId }, data: { displayToken: randomToken() } });
  await log(user.id, user.businessId, "display.token_regenerated");
  revalidatePath("/settings");
}

const apiKeySchema = z.object({
  name: z.string().trim().min(2, "Ponle un nombre a la key").max(60),
  source: z.enum(ORDER_SOURCES).refine((s) => s !== "MANUAL", "Origen no válido"),
});

export type ApiKeyState = (FormState & { key?: string }) | undefined;

export async function createApiKeyAction(_: ApiKeyState, form: FormData): Promise<ApiKeyState> {
  const user = await admin();
  const parsed = apiKeySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail(parsed.error);
  const { key, record } = await createApiKey(user.businessId, parsed.data.name, parsed.data.source);
  await log(user.id, user.businessId, "apikey.created", { apiKeyId: record.id, source: record.source });
  revalidatePath("/settings");
  return { ok: true, message: "Copia la key ahora: no se volverá a mostrar.", key };
}

export async function revokeApiKey(keyId: string) {
  const user = await admin();
  const { count } = await prisma.apiKey.updateMany({ where: { id: keyId, businessId: user.businessId, revokedAt: null }, data: { revokedAt: new Date() } });
  if (count) await log(user.id, user.businessId, "apikey.revoked", { apiKeyId: keyId });
  revalidatePath("/settings");
}

const creditRequestSchema = z.object({
  amount: z.coerce.number().int("Cantidad no válida").min(100, "Mínimo 100 SMS").max(100_000, "Máximo 100.000 SMS"),
  note: z.string().trim().max(200).optional(),
});

/** El negocio pide una recarga; el superadmin la aprueba al recibir el pago. */
export async function requestCredits(_: FormState, form: FormData): Promise<FormState> {
  const user = await admin();
  const parsed = creditRequestSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail(parsed.error);
  const pending = await prisma.creditRequest.count({ where: { businessId: user.businessId, status: "PENDING" } });
  if (pending >= 3) return { error: "Ya tienes 3 solicitudes pendientes. Espera a que se procesen." };
  const request = await prisma.creditRequest.create({
    data: { businessId: user.businessId, amount: parsed.data.amount, note: parsed.data.note || null, requestedBy: user.id },
  });
  await log(user.id, user.businessId, "credits.requested", { requestId: request.id, amount: request.amount });
  revalidatePath("/settings");
  return { ok: true, message: "Solicitud enviada. Te confirmaremos cuando se acrediten los SMS." };
}
