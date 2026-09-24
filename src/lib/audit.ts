import { prisma } from "./db";

export type Actor = `user:${string}` | `apikey:${string}` | `platform:${string}` | "public" | "system";

/** Registro de acciones importantes. Nunca debe romper el flujo principal. */
export async function audit(entry: {
  businessId: string;
  actor: Actor;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: { ...entry, metadata: entry.metadata ? JSON.stringify(entry.metadata) : undefined },
    });
  } catch (err) {
    console.error("[audit] no se pudo registrar", entry.action, err);
  }
}
