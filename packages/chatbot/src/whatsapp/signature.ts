import { createHmac, timingSafeEqual } from "node:crypto";

/** Confere o cabeçalho X-Hub-Signature-256 da Meta (HMAC-SHA256 do corpo bruto com o App Secret). */
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!appSecret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  const given = Buffer.from(header.slice(7), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
