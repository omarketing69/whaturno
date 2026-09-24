/**
 * Preparación para el ecosistema (NO es una integración completa).
 *
 * Identidad común: el teléfono E.164 del cliente (ver src/lib/phone.ts).
 * Cada app se vende por separado; la conexión futura se hará por API + eventos
 * (src/domain/events.ts), nunca compartiendo base de datos.
 */
export type EcosystemApp = "DIGITURNO" | "WHATSORDER" | "PASS2ONE" | "DOMI911";

/** Identificador del cliente entre apps. */
export type CustomerIdentity = { phone: string /* E.164 */; businessId: string };

export type IntegrationStatus = "AVAILABLE" | "COMING_SOON";

export const INTEGRATIONS: { key: string; name: string; description: string; status: IntegrationStatus }[] = [
  { key: "API", name: "API", description: "Cualquier sistema puede crear y actualizar pedidos con una API key.", status: "AVAILABLE" },
  { key: "WHATSORDER", name: "WhatsOrder", description: "Recibe pedidos de WhatsOrder y avisa cuando estén listos.", status: "AVAILABLE" },
  { key: "POS", name: "POS", description: "Conecta tu punto de venta.", status: "COMING_SOON" },
  { key: "BILLING", name: "Facturación", description: "Crea turnos al facturar.", status: "COMING_SOON" },
  { key: "PASS2ONE", name: "Pass2One", description: "Promociones para clientes con consentimiento de marketing.", status: "COMING_SOON" },
  { key: "DOMI911", name: "Domi911", description: "Solicitud de domiciliarios.", status: "COMING_SOON" },
];
