import "server-only";
import { headers } from "next/headers";
import { clientIp } from "./rateLimit";

export async function requestIp(): Promise<string> {
  return clientIp(await headers());
}
