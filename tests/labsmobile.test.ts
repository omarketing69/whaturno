import { describe, expect, it } from "vitest";
import { LabsMobileSmsProvider, smsProviderFromEnv } from "@/domain/notifications/providers/sms";

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("LabsMobileSmsProvider", () => {
  it("envía con Basic auth, número sin + y remitente", async () => {
    const { impl, calls } = fakeFetch(200, { code: "0", subid: "abc123", message: "Message has been successfully sent." });
    const r = await new LabsMobileSmsProvider("yo@correo.com", "tok", "CafeDemo", false, impl).send("+573155551234", "Hola");
    expect(r).toEqual({ ok: true, provider: "labsmobile", providerMessageId: "abc123" });
    expect(calls[0].url).toBe("https://api.labsmobile.com/json/send");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Basic " + Buffer.from("yo@correo.com:tok").toString("base64"));
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ message: "Hola", recipient: [{ msisdn: "573155551234" }], tpoa: "CafeDemo" });
  });

  it("reporta errores de LabsMobile (ej. sin saldo)", async () => {
    const { impl } = fakeFetch(200, { code: "35", message: "The account has no enough credit for this sending" });
    const r = await new LabsMobileSmsProvider("u", "t", undefined, false, impl).send("+573155551234", "x");
    expect(r).toMatchObject({ ok: false, provider: "labsmobile" });
    expect(!r.ok && r.error).toContain("35");
  });

  it("se configura desde variables de entorno", () => {
    expect(smsProviderFromEnv({ SMS_PROVIDER: "labsmobile", LABSMOBILE_USERNAME: "u", SMS_API_KEY: "k" }).name).toBe("labsmobile");
    expect(() => smsProviderFromEnv({ SMS_PROVIDER: "labsmobile" })).toThrow(/LABSMOBILE_USERNAME/);
  });
});
