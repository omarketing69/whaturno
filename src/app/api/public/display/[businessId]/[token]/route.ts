import { NextResponse } from "next/server";
import { businessForDisplay } from "@/domain/public";
import { getReadyForDisplay } from "@/domain/orders/queries";
import { publicLimit } from "@/lib/publicRateLimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ businessId: string; token: string }> }) {
  const limited = publicLimit(req, "display");
  if (limited) return limited;
  const { businessId, token } = await params;
  const business = await businessForDisplay(businessId, token);
  if (!business) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ ready: await getReadyForDisplay(business.id) }, { headers: { "Cache-Control": "no-store" } });
}
