import { prisma } from "../db";
import { randomToken, sha256 } from "../tokens";

const PREFIX = "dt_live_";

/** Genera una API key. La key completa solo se muestra una vez; se guarda su hash. */
export async function createApiKey(businessId: string, name: string, source: string) {
  const key = PREFIX + randomToken(32);
  const record = await prisma.apiKey.create({
    data: { businessId, name, source, prefix: key.slice(0, PREFIX.length + 6), keyHash: sha256(key) },
  });
  return { key, record };
}

/** Valida "Authorization: Bearer dt_live_..." y devuelve la key activa. */
export async function authenticateApiKey(headers: Headers) {
  const auth = headers.get("authorization") ?? "";
  const key = auth.startsWith("Bearer ") ? auth.slice(7).trim() : headers.get("x-api-key")?.trim();
  if (!key || !key.startsWith(PREFIX)) return null;
  const record = await prisma.apiKey.findUnique({ where: { keyHash: sha256(key) } });
  if (!record || record.revokedAt) return null;
  // Actualización "best effort", no bloquea la request
  prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return record;
}
