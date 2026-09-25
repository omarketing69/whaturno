import type { SendResult, SmsProvider } from "../types";

/** Desarrollo: no envía nada, imprime el mensaje en la consola del servidor. */
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = "console";
  async send(phone: string, message: string): Promise<SendResult> {
    console.log(`[SMS:console] → ${phone}: ${message}`);
    return { ok: true, provider: this.name, providerMessageId: `console-${Date.now()}` };
  }
}

/**
 * LabsMobile — API JSON (https://api.labsmobile.com/json/send).
 * Autenticación Basic con el usuario de la cuenta (correo) y el token de API.
 * Requiere LABSMOBILE_USERNAME y SMS_API_KEY; SMS_SENDER (remitente, máx. 11
 * caracteres) es opcional. LABSMOBILE_TEST=1 activa el modo simulado (no envía ni cobra).
 */
export class LabsMobileSmsProvider implements SmsProvider {
  readonly name = "labsmobile";
  constructor(
    private readonly username: string,
    private readonly token: string,
    private readonly sender?: string,
    private readonly test = false,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(phone: string, message: string): Promise<SendResult> {
    try {
      const res = await this.fetchImpl("https://api.labsmobile.com/json/send", {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${this.username}:${this.token}`).toString("base64"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          // LabsMobile espera el número E.164 sin el "+"
          recipient: [{ msisdn: phone.replace(/^\+/, "") }],
          ...(this.sender && { tpoa: this.sender }),
          ...(this.test && { test: 1 }),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = (await res.json().catch(() => ({}))) as { code?: string | number; message?: string; subid?: string };
      if (!res.ok || String(data.code) !== "0") {
        return { ok: false, provider: this.name, error: `LabsMobile ${data.code ?? res.status}: ${data.message ?? res.statusText}` };
      }
      return { ok: true, provider: this.name, providerMessageId: data.subid };
    } catch (err) {
      return { ok: false, provider: this.name, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

/** Crea el proveedor SMS según variables de entorno. */
export function smsProviderFromEnv(env: Record<string, string | undefined> = process.env): SmsProvider {
  switch ((env.SMS_PROVIDER || "console").toLowerCase()) {
    case "labsmobile":
      if (!env.LABSMOBILE_USERNAME || !env.SMS_API_KEY) {
        throw new Error("SMS_PROVIDER=labsmobile requiere LABSMOBILE_USERNAME y SMS_API_KEY");
      }
      return new LabsMobileSmsProvider(env.LABSMOBILE_USERNAME, env.SMS_API_KEY, env.SMS_SENDER || undefined, env.LABSMOBILE_TEST === "1");
    case "console":
      return new ConsoleSmsProvider();
    default:
      throw new Error(`SMS_PROVIDER desconocido: ${env.SMS_PROVIDER}`);
  }
}
