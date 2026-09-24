/**
 * Crea (o reactiva y cambia la contraseña de) un superadmin de la plataforma.
 * Uso: pnpm admin:create correo@dominio.com "Nombre"
 * La contraseña se pide por consola (o se toma de ADMIN_PASSWORD).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createInterface } from "node:readline/promises";

async function main() {
  const [email, name = "Superadmin"] = process.argv.slice(2);
  if (!email || !email.includes("@")) {
    console.error('Uso: pnpm admin:create correo@dominio.com "Nombre"');
    process.exit(1);
  }
  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    password = await rl.question("Contraseña (mínimo 12 caracteres): ");
    rl.close();
  }
  if (password.length < 12) {
    console.error("La contraseña debe tener al menos 12 caracteres.");
    process.exit(1);
  }
  const prisma = new PrismaClient();
  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.platformAdmin.upsert({
    where: { email: email.toLowerCase() },
    create: { email: email.toLowerCase(), name, passwordHash },
    update: { passwordHash, active: true },
  });
  await prisma.platformSession.deleteMany({ where: { adminId: admin.id } });
  console.log(`Superadmin listo: ${admin.email}. Entra en /admin/login`);
  await prisma.$disconnect();
}

main();
