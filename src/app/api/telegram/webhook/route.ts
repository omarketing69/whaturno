import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { safeEqual } from "@/lib/tokens";
import { TelegramBotProvider } from "@/domain/notifications/providers/telegram";

export const dynamic = "force-dynamic";

/**
 * Webhook del bot de Telegram. Telegram solo permite escribirle a un usuario que
 * inició el bot: el link de seguimiento abre t.me/<bot>?start=<trackingToken>,
 * y aquí asociamos el chat_id al cliente de ese pedido.
 * Configurar con setWebhook + secret_token = TELEGRAM_WEBHOOK_SECRET.
 */
export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const header = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!secret || !safeEqual(header, secret)) return NextResponse.json({ ok: false }, { status: 401 });

  const update = (await req.json().catch(() => null)) as { message?: { text?: string; chat?: { id?: number } } } | null;
  const text = update?.message?.text ?? "";
  const chatId = update?.message?.chat?.id;
  const match = text.match(/^\/start\s+([\w-]{10,64})$/);
  if (!chatId || !match) return NextResponse.json({ ok: true });

  const order = await prisma.order.findUnique({
    where: { trackingToken: match[1] },
    select: { orderNumber: true, businessId: true, customerId: true, business: { select: { name: true } } },
  });
  const bot = new TelegramBotProvider();
  if (!order?.customerId) {
    await bot.send(String(chatId), "No encontramos ese pedido.");
    return NextResponse.json({ ok: true });
  }
  await prisma.customer.update({ where: { id: order.customerId }, data: { telegramChatId: String(chatId) } });
  await audit({ businessId: order.businessId, actor: "public", action: "customer.telegram_linked", entityType: "customer", entityId: order.customerId });
  await bot.send(String(chatId), `Listo. Te avisaremos por aquí cuando tu pedido #${order.orderNumber} de ${order.business.name} esté listo.`);
  return NextResponse.json({ ok: true });
}
