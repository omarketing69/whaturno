import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getBoard } from "@/domain/orders/queries";
import { KitchenBoard } from "./KitchenBoard";

export const metadata: Metadata = { title: "Cocina" };

export default async function KitchenPage() {
  const user = await requireUser(["ADMIN", "CASHIER", "KITCHEN"]);
  return <KitchenBoard initial={await getBoard(user.businessId)} canCancel={user.role !== "KITCHEN"} />;
}
