import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { businessForDisplay } from "@/domain/public";
import { getReadyForDisplay } from "@/domain/orders/queries";
import { PublicDisplay } from "./PublicDisplay";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pedidos listos", robots: { index: false, follow: false } };

export default async function DisplayPage({ params }: { params: Promise<{ businessId: string; token: string }> }) {
  const { businessId, token } = await params;
  const business = await businessForDisplay(businessId, token);
  if (!business) notFound();
  return (
    <PublicDisplay
      endpoint={`/api/public/display/${businessId}/${token}`}
      initial={await getReadyForDisplay(business.id)}
      business={{ name: business.name, logoUrl: business.logoUrl, brandColor: business.brandColor }}
    />
  );
}
