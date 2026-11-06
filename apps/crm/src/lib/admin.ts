import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/** Limpa espaços, quebras de linha e aspas que vêm junto ao colar a chave. */
const clean = (v: string | undefined) => (v ?? "").trim().replace(/^["']+|["']+$/g, "").trim();

export const configuredAdminToken = () => clean(process.env.ADMIN_TOKEN);

/** Confere a chave da Dynamo (ADMIN_TOKEN). Sem um token forte configurado, nada é liberado. */
export function checkAdminToken(given: string) {
  const expected = configuredAdminToken();
  if (expected.length < 32) return false;
  const h = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(h(clean(given)), h(expected));
}

/** Dica para conferir a chave sem revelá-la: tamanho e últimos 4 caracteres. */
export function adminTokenHint(given: string) {
  const expected = configuredAdminToken();
  const g = clean(given);
  return `A chave configurada tem ${expected.length} caracteres e termina em "…${expected.slice(-4)}". A digitada tem ${g.length} caracteres e termina em "…${g.slice(-4)}".`;
}
