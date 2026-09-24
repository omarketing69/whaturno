import { prisma } from "@/lib/db";
import { randomToken } from "@/lib/tokens";
import { NotificationService } from "@/domain/notifications/NotificationService";
import type { SendResult, SmsProvider } from "@/domain/notifications/types";

export async function makeBusiness(
  data: Partial<{ name: string; numberingMode: string; orderPrefix: string; requirePhone: boolean; smsExtraBalance: number; planId: string; timezone: string }> = {},
) {
  // Por defecto con saldo de SMS para que las pruebas de notificación no dependan del billing
  return prisma.business.create({ data: { name: data.name ?? "Negocio " + randomToken(4), displayToken: randomToken(), smsExtraBalance: 1000, ...data } });
}

export class FakeSms implements SmsProvider {
  readonly name = "fake";
  sent: { phone: string; message: string }[] = [];
  constructor(private fail = false) {}
  async send(phone: string, message: string): Promise<SendResult> {
    if (this.fail) return { ok: false, provider: this.name, error: "boom" };
    this.sent.push({ phone, message });
    return { ok: true, provider: this.name, providerMessageId: "m-" + this.sent.length };
  }
}

export function fakeNotifications(sms = new FakeSms()) {
  return { sms, service: new NotificationService({ sms }) };
}
