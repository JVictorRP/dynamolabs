import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/** Confere a chave da Dynamo (ADMIN_TOKEN). Sem um token forte configurado, nada é liberado. */
export function checkAdminToken(given: string) {
  const expected = process.env.ADMIN_TOKEN?.trim();
  if (!expected || expected.length < 32) return false;
  const h = (v: string) => createHash("sha256").update(v.trim()).digest();
  return timingSafeEqual(h(given), h(expected));
}
