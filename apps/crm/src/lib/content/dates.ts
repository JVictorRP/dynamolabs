/** Campos de data das telas da equipe: horário de Brasília (UTC−3, sem horário de verão desde 2019). */
const OFFSET_MS = 3 * 3600_000;
const RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Valor de `<input type="datetime-local">` (horário de Brasília) → Date. Vazio ou inválido: null. */
export function parseSaoPauloLocal(value: string): Date | null {
  const m = RE.exec(value.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi) + OFFSET_MS);
  const back = new Date(date.getTime() - OFFSET_MS);
  const valid = back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d && back.getUTCHours() === h && back.getUTCMinutes() === mi;
  return valid ? date : null;
}

export function toSaoPauloLocal(date: Date | null): string {
  if (!date) return "";
  const l = new Date(date.getTime() - OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${l.getUTCFullYear()}-${p(l.getUTCMonth() + 1)}-${p(l.getUTCDate())}T${p(l.getUTCHours())}:${p(l.getUTCMinutes())}`;
}
