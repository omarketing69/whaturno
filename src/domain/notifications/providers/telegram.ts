import type { SendResult, TelegramProvider } from "../types";

export class TelegramBotProvider implements TelegramProvider {
  readonly name = "telegram";
  constructor(
    private readonly token = process.env.TELEGRAM_BOT_TOKEN,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  isConfigured() {
    return Boolean(this.token);
  }

  async send(chatId: string, message: string): Promise<SendResult> {
    if (!this.token) return { ok: false, provider: this.name, error: "TELEGRAM_BOT_TOKEN no configurado" };
    try {
      const res = await this.fetchImpl(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: message }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string; result?: { message_id?: number } };
      if (!data.ok) return { ok: false, provider: this.name, error: data.description || `HTTP ${res.status}` };
      return { ok: true, provider: this.name, providerMessageId: String(data.result?.message_id ?? "") };
    } catch (err) {
      return { ok: false, provider: this.name, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
