import { describe, expect, it } from "vitest";
import { maskPhone, normalizePhone } from "@/lib/phone";

describe("normalizePhone", () => {
  it.each(["3155551234", "315 555 1234", "+57 3155551234", "+573155551234", "573155551234", "(315) 555-1234", "0057 315 555 1234"])(
    "%s → +573155551234",
    (input) => expect(normalizePhone(input, "CO")).toBe("+573155551234"),
  );

  it("rechaza números inválidos", () => {
    expect(normalizePhone("123", "CO")).toBeNull();
    expect(normalizePhone("", "CO")).toBeNull();
    expect(normalizePhone("abc", "CO")).toBeNull();
  });

  it("respeta números de otros países", () => {
    expect(normalizePhone("+52 55 1234 5678", "CO")).toBe("+525512345678");
  });

  it("enmascara", () => expect(maskPhone("+573155551234")).toBe("***1234"));
});
