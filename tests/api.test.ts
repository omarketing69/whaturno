import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createApiKey } from "@/lib/auth/apiKey";
import { POST } from "@/app/api/v1/orders/route";
import { GET, PATCH } from "@/app/api/v1/orders/[id]/route";
import { GET as displayGET } from "@/app/api/public/display/[businessId]/[token]/route";
import { GET as trackGET } from "@/app/api/public/track/[token]/route";
import { makeBusiness } from "./helpers";

const url = "http://localhost:3000/api/v1/orders";
const req = (method: string, key: string | null, body?: unknown, path = "") =>
  new Request(url + path, {
    method,
    headers: { "content-type": "application/json", ...(key && { authorization: `Bearer ${key}` }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const params = <T,>(p: T) => ({ params: Promise.resolve(p) });

describe("API v1", () => {
  it("rechaza requests sin API key o con key revocada", async () => {
    expect((await POST(req("POST", null, {}))).status).toBe(401);
    expect((await POST(req("POST", "dt_live_falsa", {}))).status).toBe(401);
    const b = await makeBusiness();
    const { key, record } = await createApiKey(b.id, "k", "API");
    await prisma.apiKey.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
    expect((await POST(req("POST", key, { external_order_id: "1", customer: { phone: "3155551234" } }))).status).toBe(401);
  });

  it("crea (idempotente), consulta y marca READY; aparece en la pantalla pública", async () => {
    const b = await makeBusiness();
    const { key } = await createApiKey(b.id, "WhatsOrder", "WHATSORDER");
    const payload = { external_order_id: "583", customer: { phone: "+573155551234", name: "Juan" }, status: "PREPARING" };

    const res = await POST(req("POST", key, payload));
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data).toMatchObject({ order_number: "583", source: "WHATSORDER", status: "PREPARING", customer: { phone: "***1234", name: "Juan" } });
    expect(JSON.stringify(data)).not.toContain("3155551234");

    const again = await POST(req("POST", key, payload));
    expect(again.status).toBe(200);
    expect((await again.json()).data.id).toBe(data.id);

    const ready = await PATCH(req("PATCH", key, { status: "READY" }), params({ id: data.id }));
    expect(ready.status).toBe(200);
    const readyBody = (await ready.json()).data;
    expect(readyBody.status).toBe("READY");
    expect(readyBody.ready_at).toBeTruthy();
    expect(readyBody.notification).toMatchObject({ channel: "SMS", status: "SENT" });

    const byExternal = await GET(req("GET", key, undefined, "/583?lookup=external"), params({ id: "583" }));
    expect(byExternal.status).toBe(200);

    const display = await displayGET(new Request("http://x"), params({ businessId: b.id, token: b.displayToken }));
    const shown = await display.json();
    expect(shown.ready).toEqual([expect.objectContaining({ number: "583" })]);
    expect(JSON.stringify(shown)).not.toMatch(/Juan|1234/);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: data.id } });
    const track = await (await trackGET(new Request("http://x"), params({ token: order.trackingToken }))).json();
    expect(track).toMatchObject({ orderNumber: "583", status: "READY" });
    expect(JSON.stringify(track)).not.toMatch(/Juan|\+57|cl[a-z0-9]{20}/);
  });

  it("una API key no puede ver ni modificar pedidos de otro negocio", async () => {
    const a = await makeBusiness();
    const b = await makeBusiness();
    const { key: keyA } = await createApiKey(a.id, "a", "API");
    const { key: keyB } = await createApiKey(b.id, "b", "API");
    const { data } = await (await POST(req("POST", keyA, { external_order_id: "X1", customer: { phone: "3155551234" } }))).json();
    expect((await GET(req("GET", keyB), params({ id: data.id }))).status).toBe(404);
    expect((await PATCH(req("PATCH", keyB, { status: "READY" }), params({ id: data.id }))).status).toBe(404);
  });

  it("valida el payload", async () => {
    const b = await makeBusiness();
    const { key } = await createApiKey(b.id, "k", "API");
    expect((await POST(req("POST", key, { customer: { phone: "3155551234" } }))).status).toBe(422);
    expect((await POST(req("POST", key, { external_order_id: "1", customer: { phone: "12" } }))).status).toBe(422);
    expect((await POST(req("POST", key, { external_order_id: "1", price: 10 }))).status).toBe(422); // Digiturno no recibe precios
    const r = await POST(req("POST", key, { external_order_id: "2", customer: { phone: "3155551234" } }));
    const { data } = await r.json();
    expect((await PATCH(req("PATCH", key, { status: "DELIVERED" }), params({ id: data.id }))).status).toBe(409);
  });

  it("pantalla pública con token incorrecto → 404", async () => {
    const b = await makeBusiness();
    const res = await displayGET(new Request("http://x"), params({ businessId: b.id, token: "otro-token" }));
    expect(res.status).toBe(404);
  });
});
