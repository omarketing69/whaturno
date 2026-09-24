import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/**
 * Normaliza un teléfono a E.164 (+573155551234).
 * El teléfono es la identidad común del cliente en todo el ecosistema,
 * por eso NUNCA se guarda tal como se escribió.
 * Devuelve null si no es un número válido.
 */
export function normalizePhone(input: string, defaultCountry = "CO"): string | null {
  if (!input) return null;
  const cleaned = input.trim().replace(/[^\d+]/g, "");
  if (!cleaned) return null;

  const candidates = cleaned.startsWith("+")
    ? [cleaned]
    : cleaned.startsWith("00")
      ? ["+" + cleaned.slice(2)]
      : [cleaned, "+" + cleaned]; // "573155551234" sin "+" también se acepta

  for (const candidate of candidates) {
    const parsed = parsePhoneNumberFromString(candidate, defaultCountry as CountryCode);
    if (parsed?.isValid()) return parsed.number;
  }
  return null;
}

/** +573155551234 → ***1234 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  return "***" + phone.slice(-4);
}

/** Formato legible para mostrar a quien sí puede verlo: +57 315 555 1234 */
export function formatPhone(phone: string): string {
  return parsePhoneNumberFromString(phone)?.formatInternational() ?? phone;
}
