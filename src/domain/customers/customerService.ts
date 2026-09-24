import type { Prisma, PrismaClient } from "@prisma/client";
import { normalizePhone } from "@/lib/phone";
import { DomainError } from "../errors";

type Tx = PrismaClient | Prisma.TransactionClient;

/** Busca o crea al cliente por (negocio, teléfono E.164). */
export async function upsertCustomer(
  db: Tx,
  businessId: string,
  rawPhone: string,
  country: string,
  name?: string | null,
) {
  const phone = normalizePhone(rawPhone, country);
  if (!phone) throw new DomainError("INVALID_PHONE", "El número de celular no es válido");
  const cleanName = name?.trim() || undefined;
  return db.customer.upsert({
    where: { businessId_phone: { businessId, phone } },
    create: { businessId, phone, name: cleanName },
    update: cleanName ? { name: cleanName } : {},
  });
}

/**
 * Guarda el consentimiento vigente. Notificaciones y marketing son independientes.
 * Un "false" recibido al registrar un pedido NO revoca un consentimiento previo:
 * solo se otorga. La revocación es una acción explícita (revokeConsent).
 * Devuelve qué cambió, para dejar evidencia en el log de auditoría.
 */
export async function grantConsent(
  db: Tx,
  input: { businessId: string; customerId: string; notification: boolean; marketing: boolean; source: string },
) {
  const now = new Date();
  const existing = await db.consent.findUnique({ where: { customerId: input.customerId } });
  const grantNotification = input.notification && !existing?.notificationConsent;
  const grantMarketing = input.marketing && !existing?.marketingConsent;

  if (!existing) {
    const consent = await db.consent.create({
      data: {
        businessId: input.businessId,
        customerId: input.customerId,
        notificationConsent: input.notification,
        notificationConsentAt: input.notification ? now : null,
        marketingConsent: input.marketing,
        marketingConsentAt: input.marketing ? now : null,
        consentDate: now,
        consentSource: input.source,
      },
    });
    return { consent, changed: input.notification || input.marketing };
  }
  if (!grantNotification && !grantMarketing) return { consent: existing, changed: false };

  const consent = await db.consent.update({
    where: { id: existing.id },
    data: {
      ...(grantNotification && { notificationConsent: true, notificationConsentAt: now }),
      ...(grantMarketing && { marketingConsent: true, marketingConsentAt: now }),
      consentDate: now,
      consentSource: input.source,
    },
  });
  return { consent, changed: true };
}

export async function revokeConsent(
  db: Tx,
  input: { customerId: string; notification?: boolean; marketing?: boolean; source: string },
) {
  return db.consent.update({
    where: { customerId: input.customerId },
    data: {
      ...(input.notification && { notificationConsent: false }),
      ...(input.marketing && { marketingConsent: false }),
      consentDate: new Date(),
      consentSource: input.source,
    },
  });
}
