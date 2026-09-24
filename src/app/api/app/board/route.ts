import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getBoard } from "@/domain/orders/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!user.businessActive) return NextResponse.json({ error: "Cuenta suspendida" }, { status: 403 });
  return NextResponse.json({ orders: await getBoard(user.businessId) }, { headers: { "Cache-Control": "no-store" } });
}
