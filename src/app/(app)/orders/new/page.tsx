import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { NewOrderForm } from "./NewOrderForm";

export const metadata: Metadata = { title: "Nuevo pedido" };

export default async function NewOrderPage() {
  const user = await requireUser(["ADMIN", "CASHIER"]);
  const b = await prisma.business.findUniqueOrThrow({ where: { id: user.businessId } });
  return (
    <div className="mx-auto max-w-lg">
      <NewOrderForm
        autoNumber={b.numberingMode === "AUTO"}
        prefix={b.orderPrefix}
        country={b.country}
        requirePhone={b.requirePhone}
      />
    </div>
  );
}
