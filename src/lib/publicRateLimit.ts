import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "./rateLimit";

/** Límite para endpoints públicos (pantallas y seguimiento). Devuelve respuesta 429 o null. */
export function publicLimit(req: Request, bucket: string, limit = 120): NextResponse | null {
  const r = rateLimit(`${bucket}:${clientIp(req.headers)}`, limit, 60_000);
  return r.ok ? null : NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429, headers: { "Retry-After": String(r.retryAfter) } });
}
