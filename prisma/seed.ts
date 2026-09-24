/**
 * Datos de demostración: negocio + 3 usuarios (uno por rol) + una API key.
 * Uso: pnpm db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";

const prisma = new PrismaClient();
const PASSWORD = "digiturno123";

async function main() {
  if (await prisma.user.findUnique({ where: { email: "admin@demo.co" } })) {
    console.log("El seed ya existe. Usa `pnpm db:reset` para empezar de cero.");
    return;
  }
  const business = await prisma.business.create({
    data: { name: "Café Demo", displayToken: randomBytes(24).toString("base64url"), orderPrefix: "", address: "Calle 10 # 5-20" },
  });
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
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

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  console.log(`
Negocio demo creado: ${business.name}
  Usuarios (contraseña: ${PASSWORD})
    admin@demo.co   → Administrador
    cajero@demo.co  → Cajero
    cocina@demo.co  → Cocina
  Pantalla pública: ${appUrl}/business/${business.id}/display/${business.displayToken}
  API key (origen WhatsOrder): ${key}
`);
}

main().finally(() => prisma.$disconnect());
