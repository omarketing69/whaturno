import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { publicOrderStatus } from "@/domain/public";
import { TrackingView } from "./TrackingView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Estado de tu pedido", robots: { index: false, follow: false } };

export default async function TrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const status = await publicOrderStatus(token);
  if (!status) notFound();
  const bot = process.env.TELEGRAM_BOT_USERNAME;
  return <TrackingView token={token} initial={status} telegramLink={status.telegramEnabled && bot ? `https://t.me/${bot}?start=${token}` : null} />;
}
