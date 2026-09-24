"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "../db";
import { hashPassword, verifyPassword } from "../auth/password";
import { createSession, destroySession, homeFor } from "../auth/session";
import { rateLimit } from "../rateLimit";
import { requestIp } from "../request";
import { randomToken } from "../tokens";
import { audit } from "../audit";
import type { Role } from "../constants";
import type { FormState } from "./types";

const signupSchema = z.object({
  businessName: z.string().trim().min(2, "Escribe el nombre del negocio").max(80),
  name: z.string().trim().min(2, "Escribe tu nombre").max(80),
  email: z.string().trim().toLowerCase().email("Correo no válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(200),
});

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const ip = await requestIp();
  if (!rateLimit(`signup:${ip}`, 5, 3600_000).ok) return { error: "Demasiados intentos. Intenta más tarde." };

  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { businessName, name, email, password } = parsed.data;

  if (await prisma.user.findUnique({ where: { email } })) return { error: "Ya existe una cuenta con ese correo" };

  const user = await prisma.$transaction(async (tx) => {
    const business = await tx.business.create({ data: { name: businessName, displayToken: randomToken() } });
    return tx.user.create({
      data: { businessId: business.id, name, email, passwordHash: await hashPassword(password), role: "ADMIN" },
    });
  });
  await audit({ businessId: user.businessId, actor: `user:${user.id}`, action: "business.created", ip });
  await createSession(user.id);
  redirect("/dashboard");
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo no válido"),
  password: z.string().min(1, "Escribe tu contraseña").max(200),
});

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password } = parsed.data;

  const ip = await requestIp();
  if (!rateLimit(`login:${ip}`, 20, 900_000).ok || !rateLimit(`login:${email}`, 8, 900_000).ok) {
    return { error: "Demasiados intentos. Espera unos minutos." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Correo o contraseña incorrectos" };
  }
  await createSession(user.id);
  await audit({ businessId: user.businessId, actor: `user:${user.id}`, action: "user.login", ip });
  redirect(homeFor(user.role as Role));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
