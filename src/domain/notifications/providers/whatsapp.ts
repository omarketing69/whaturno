import type { SendResult, WhatsAppProvider } from "../types";

/** Marcador para la futura integración con Meta WhatsApp Cloud API. */
export class NotImplementedWhatsAppProvider implements WhatsAppProvider {
  readonly name = "whatsapp";
  isConfigured() {
    return false;
  }
  async send(): Promise<SendResult> {
    return { ok: false, provider: this.name, error: "WhatsApp aún no está disponible" };
  }
}
