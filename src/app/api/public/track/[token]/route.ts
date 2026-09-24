import { NextResponse } from "next/server";
import { publicOrderStatus } from "@/domain/public";
import { publicLimit } from "@/lib/publicRateLimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const limited = publicLimit(req, "track", 60);
  if (limited) return limited;
  const status = await publicOrderStatus((await params).token);
  if (!status) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
}
