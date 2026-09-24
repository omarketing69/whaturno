/** Resultado común para cualquier proveedor de mensajería. */
export type SendResult =
  | { ok: true; provider: string; providerMessageId?: string }
  | { ok: false; provider: string; error: string };

/** Interfaz de SMS. El resto de la app nunca depende del SDK/API del proveedor concreto. */
export interface SmsProvider {
  readonly name: string;
  send(phone: string, message: string): Promise<SendResult>;
}

/** Telegram solo funciona si el cliente inició el bot (Telegram exige esa interacción previa). */
export interface TelegramProvider {
  readonly name: string;
  isConfigured(): boolean;
  send(chatId: string, message: string): Promise<SendResult>;
}

/** WhatsApp (Meta Cloud API) — integración futura. */
export interface WhatsAppProvider {
  readonly name: string;
  isConfigured(): boolean;
  send(phone: string, message: string): Promise<SendResult>;
}
