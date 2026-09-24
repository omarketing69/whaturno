/**
 * Datos de demostración. Se puede ejecutar varias veces sin duplicar.
 * - Planes: Básico (300 SMS/mes, por defecto) y Pro (1.500 SMS/mes)
 * - Superadmin de la plataforma: superadmin@demo.co
 * - Negocio "Café Demo" con 3 usuarios (uno por rol) y una API key
 * Uso: pnpm db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";

const prisma = new PrismaClient();
const PASSWORD = "digiturno123";

async function plan(name: string, monthlySmsCredits: number, priceMonthly: number, isDefault: boolean) {
  return (
    (await prisma.plan.findFirst({ where: { name } })) ??
    prisma.plan.create({ data: { name, monthlySmsCredits, priceMonthly, isDefault } })
  );
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const basic = await plan("Básico", 300, 49000, true);
  await plan("Pro", 1500, 149000, false);

  await prisma.platformAdmin.upsert({
    where: { email: "superadmin@demo.co" },
    create: { email: "superadmin@demo.co", name: "Superadmin Demo", passwordHash },
    update: {},
  });

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const existing = await prisma.user.findUnique({ where: { email: "admin@demo.co" }, include: { business: true } });
  if (existing) {
    if (!existing.business.planId) await prisma.business.update({ where: { id: existing.businessId }, data: { planId: basic.id } });
    console.log(`Seed actualizado (planes y superadmin). Negocio demo ya existía.
  Superadmin: superadmin@demo.co / ${PASSWORD} → ${appUrl}/admin/login`);
    return;
  }

  const business = await prisma.business.create({
    data: { name: "Café Demo", displayToken: randomBytes(24).toString("base64url"), address: "Calle 10 # 5-20", planId: basic.id },
  });
  for (const [name, email, role] of [
    ["Ana Admin", "admin@demo.co", "ADMIN"],
    ["Carlos Cajero", "cajero@demo.co", "CASHIER"],
    ["Cata Cocina", "cocina@demo.co", "KITCHEN"],
  ]) {
    await prisma.user.create({ data: { businessId: business.id, name, email, role, passwordHash } });
  }
  const key = "dt_live_" + randomBytes(32).toString("base64url");
  await prisma.apiKey.create({
    data: { businessId: business.id, name: "Demo WhatsOrder", source: "WHATSORDER", prefix: key.slice(0, 14), keyHash: createHash("sha256").update(key).digest("hex") },
  });

  console.log(`
Negocio demo creado: ${business.name} (plan Básico, 300 SMS/mes)
  Usuarios (contraseña: ${PASSWORD})
    admin@demo.co   → Administrador
    cajero@demo.co  → Cajero
    cocina@demo.co  → Cocina
  Superadmin: superadmin@demo.co / ${PASSWORD} → ${appUrl}/admin/login
  Pantalla pública: ${appUrl}/business/${business.id}/display/${business.displayToken}
  API key (origen WhatsOrder): ${key}
`);
}

main().finally(() => prisma.$disconnect());
