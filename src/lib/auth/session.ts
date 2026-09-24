import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "../db";
import { randomToken, sha256 } from "../tokens";
import type { Role } from "../constants";

const COOKIE = "dt_session";
const SESSION_DAYS = 14;

export async function createSession(userId: string) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await prisma.session.create({ data: { userId, tokenHash: sha256(token), expiresAt } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(COOKIE);
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  businessId: string;
  businessActive: boolean;
};

/** Usuario autenticado o null. Cacheado por request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { business: { select: { status: true } } } } },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  const { id, name, email, role, businessId } = session.user;
  return { id, name, email, role: role as Role, businessId, businessActive: session.user.business.status === "ACTIVE" };
});

/** Para páginas: redirige a /login o a la página de inicio de su rol si no tiene permiso. */
export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.businessActive) redirect("/suspended");
  if (roles && !roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

export function homeFor(role: Role): string {
  return role === "ADMIN" ? "/dashboard" : role === "CASHIER" ? "/orders/new" : "/kitchen";
}
