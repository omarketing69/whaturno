import { describe, expect, it } from "vitest";
import { renderTemplate } from "@/domain/notifications/template";
import { dateRange, localDateKey } from "@/lib/time";

describe("renderTemplate", () => {
  it("reemplaza variables", () => {
    expect(renderTemplate("Tu pedido #{order_id} está listo en {business_name}. {customer_name}", { order_id: "583", business_name: "Pan", customer_name: "Juan" }))
      .toBe("Tu pedido #583 está listo en Pan. Juan");
  });
  it("variables vacías y desconocidas", () => {
    expect(renderTemplate("Hola {customer_name} {otra}", { order_id: "1", business_name: "x", customer_name: null })).toBe("Hola {otra}");
  });
});

describe("time", () => {
  it("día local en Bogotá (UTC-5)", () => {
    const d = new Date("2026-09-24T03:00:00Z"); // 23-sep 22:00 en Bogotá
    expect(localDateKey(d, "America/Bogota")).toBe("2026-09-23");
    const { from } = dateRange("today", "America/Bogota", d);
    expect(from.toISOString()).toBe("2026-09-23T05:00:00.000Z");
    expect(dateRange("yesterday", "America/Bogota", d).from.toISOString()).toBe("2026-09-22T05:00:00.000Z");
    expect(dateRange("week", "America/Bogota", d).from.toISOString()).toBe("2026-09-21T05:00:00.000Z"); // lunes
    expect(dateRange("month", "America/Bogota", d).from.toISOString()).toBe("2026-09-01T05:00:00.000Z");
  });
});
