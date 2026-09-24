import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "../db";
import { randomToken, sha256 } from "../tokens";

/**
 * Sesión del superadmin de la plataforma. Es independiente de las sesiones de
 * los negocios (otra tabla, otra cookie) para que un usuario de negocio nunca
 * pueda escalar a operador de la plataforma.
 */
const COOKIE = "dt_platform";
const SESSION_HOURS = 12;

export async function createPlatformSession(adminId: string) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3_600_000);
  await prisma.platformSession.create({ data: { adminId, tokenHash: sha256(token), expiresAt } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyPlatformSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await prisma.platformSession.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(COOKIE);
}

export const getPlatformAdmin = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.platformSession.findUnique({ where: { tokenHash: sha256(token) }, include: { admin: true } });
  if (!session || session.expiresAt < new Date() || !session.admin.active) return null;
  return { id: session.admin.id, name: session.admin.name, email: session.admin.email };
});

export async function requirePlatformAdmin() {
  const admin = await getPlatformAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
