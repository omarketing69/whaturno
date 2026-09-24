import type { Notification, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { trackingUrl } from "@/lib/config";
import type { Channel } from "@/lib/constants";
import { renderTemplate } from "./template";
import type { SendResult, SmsProvider, TelegramProvider, WhatsAppProvider } from "./types";
import { smsProviderFromEnv } from "./providers/sms";
import { TelegramBotProvider } from "./providers/telegram";
import { NotImplementedWhatsAppProvider } from "./providers/whatsapp";

export type NotificationDeps = {
  db?: PrismaClient;
  sms?: SmsProvider | (() => SmsProvider);
  telegram?: TelegramProvider;
  whatsapp?: WhatsAppProvider;
};

/**
 * Capa única de notificaciones. La lógica de pedidos solo llama a
 * notifyOrderReady(); los proveedores y canales se cambian sin tocarla.
 *
 * Selección de canal (MVP):
 *   1. Telegram, si el negocio lo habilitó y el cliente ya inició el bot (gratis).
 *   2. SMS, canal universal principal (también sirve de respaldo si Telegram falla).
 *   3. WhatsApp — futuro, deshabilitado.
 */
export class NotificationService {
  private readonly db: PrismaClient;
  private smsProvider?: SmsProvider;

  constructor(private readonly deps: NotificationDeps = {}) {
    this.db = deps.db ?? defaultPrisma;
  }

  private get sms(): SmsProvider {
    if (!this.smsProvider) {
      const s = this.deps.sms ?? smsProviderFromEnv;
      this.smsProvider = typeof s === "function" ? s() : s;
    }
    return this.smsProvider;
  }

  private get telegram(): TelegramProvider {
    return (this.deps.telegram ??= new TelegramBotProvider());
  }

  private get whatsapp(): WhatsAppProvider {
    return (this.deps.whatsapp ??= new NotImplementedWhatsAppProvider());
  }

  async sendSMS(phone: string, message: string): Promise<SendResult> {
    try {
      return await this.sms.send(phone, message);
    } catch (err) {
      return { ok: false, provider: "sms", error: err instanceof Error ? err.message : String(err) };
    }
  }

  sendTelegram(chatId: string, message: string): Promise<SendResult> {
    return this.telegram.send(chatId, message);
  }

  sendWhatsApp(phone: string, message: string): Promise<SendResult> {
    return this.whatsapp.send(phone, message);
  }

  /** Avisa al cliente que su pedido está listo. Devuelve la última notificación intentada o null si no aplica. */
  async notifyOrderReady(orderId: string): Promise<Notification | null> {
    const order = await this.db.order.findUnique({
      where: { id: orderId },
      include: { business: true, customer: { include: { consent: true } } },
    });
    if (!order || !order.notify || !order.customer) return null;
    // Sin autorización transaccional no se envía nada
    if (!order.customer.consent?.notificationConsent) return null;

    const { business, customer } = order;
    const message = renderTemplate(business.smsTemplate, {
      order_id: order.orderNumber,
      business_name: business.name,
      customer_name: customer.name,
      tracking_url: trackingUrl(order.trackingToken),
    });

    const channels: Channel[] = [];
    if (business.telegramEnabled && customer.telegramChatId && this.telegram.isConfigured()) channels.push("TELEGRAM");
    if (business.smsEnabled) channels.push("SMS");
    if (business.whatsappEnabled && this.whatsapp.isConfigured()) channels.push("WHATSAPP");

    let last: Notification | null = null;
    for (const channel of channels) {
      last = await this.db.notification.create({
        data: { businessId: business.id, orderId: order.id, customerId: customer.id, channel, message, status: "PENDING" },
      });
      const result =
        channel === "TELEGRAM"
          ? await this.sendTelegram(customer.telegramChatId!, message)
          : channel === "SMS"
            ? await this.sendSMS(customer.phone, message)
            : await this.sendWhatsApp(customer.phone, message);

      last = await this.db.notification.update({
        where: { id: last.id },
        data: result.ok
          ? { status: "SENT", provider: result.provider, providerMessageId: result.providerMessageId, sentAt: new Date() }
          : { status: "FAILED", provider: result.provider, errorMessage: result.error.slice(0, 500) },
      });
      if (result.ok) break;
    }
    return last;
  }
}

let singleton: NotificationService | undefined;
export function notificationService(): NotificationService {
  return (singleton ??= new NotificationService());
}
