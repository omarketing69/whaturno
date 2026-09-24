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
 * Bird (antes MessageBird) — Channels API.
 * Requiere SMS_API_KEY, BIRD_WORKSPACE_ID y BIRD_CHANNEL_ID (canal SMS; el remitente
 * se configura en el canal de Bird, SMS_SENDER queda como referencia).
 */
export class BirdSmsProvider implements SmsProvider {
  readonly name = "bird";
  constructor(
    private readonly apiKey: string,
    private readonly workspaceId: string,
    private readonly channelId: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(phone: string, message: string): Promise<SendResult> {
    const url = `https://api.bird.com/workspaces/${this.workspaceId}/channels/${this.channelId}/messages`;
    try {
      const res = await this.fetchImpl(url, {
        method: "POST",
        headers: { Authorization: `AccessKey ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          receiver: { contacts: [{ identifierValue: phone }] },
          body: { type: "text", text: { text: message } },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok) return { ok: false, provider: this.name, error: data.message || `HTTP ${res.status}` };
      return { ok: true, provider: this.name, providerMessageId: data.id };
    } catch (err) {
      return { ok: false, provider: this.name, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

/** Crea el proveedor SMS según variables de entorno. */
export function smsProviderFromEnv(env = process.env): SmsProvider {
  switch ((env.SMS_PROVIDER || "console").toLowerCase()) {
    case "bird":
      if (!env.SMS_API_KEY || !env.BIRD_WORKSPACE_ID || !env.BIRD_CHANNEL_ID) {
        throw new Error("SMS_PROVIDER=bird requiere SMS_API_KEY, BIRD_WORKSPACE_ID y BIRD_CHANNEL_ID");
      }
      return new BirdSmsProvider(env.SMS_API_KEY, env.BIRD_WORKSPACE_ID, env.BIRD_CHANNEL_ID);
    case "console":
      return new ConsoleSmsProvider();
    default:
      throw new Error(`SMS_PROVIDER desconocido: ${env.SMS_PROVIDER}`);
  }
}
