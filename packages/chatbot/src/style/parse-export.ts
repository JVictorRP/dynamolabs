/**
 * Leitura de conversas exportadas do WhatsApp ("Exportar conversa"), formatos Android e iPhone em pt-BR.
 * Devolve só as falas: linhas de sistema, mídia omitida e mensagens apagadas ficam de fora.
 */
import { unzipSync } from "fflate";

export type ChatLine = { at: Date; author: string; text: string };

const INVISIBLE = /[‎‏‪-‮⁦-⁩]/g;
const NARROW_SPACES = /[  ]/g;

// Android: 10/11/2026 14:32 - Nome: texto   (ano com 2 ou 4 dígitos, "às" opcional)
const ANDROID = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(?:às\s+)?(\d{1,2}):(\d{2})(?::(\d{2}))?\s+-\s+(.*)$/;
// iPhone: [10/11/2026, 14:32:05] Nome: texto   (segundos opcionais)
const IPHONE = /^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\]\s+(.*)$/;

const SKIPPED = [
  "<mídia oculta>",
  "<arquivo de mídia oculto>",
  "imagem ocultada",
  "áudio ocultado",
  "vídeo omitido",
  "figurinha omitida",
  "documento omitido",
  "gif omitido",
  "mensagem apagada",
  "esta mensagem foi apagada",
  "você apagou esta mensagem",
  "(arquivo anexado)",
];

function toDate(d: string, mo: string, y: string, h: string, mi: string, s?: string): Date {
  const year = y.length === 2 ? 2000 + Number(y) : Number(y);
  // Horário de Brasília (UTC−3, sem horário de verão desde 2019).
  return new Date(Date.UTC(year, Number(mo) - 1, Number(d), Number(h) + 3, Number(mi), Number(s ?? 0)));
}

function readText(input: { fileName: string; bytes: Uint8Array }): string {
  const isZip = input.fileName.toLowerCase().endsWith(".zip") || (input.bytes[0] === 0x50 && input.bytes[1] === 0x4b);
  if (!isZip) return new TextDecoder("utf-8").decode(input.bytes);
  const files = unzipSync(input.bytes);
  const name = Object.keys(files).find((n) => n.toLowerCase().endsWith(".txt"));
  if (!name) throw new Error("O arquivo .zip não tem a conversa (.txt) dentro.");
  return new TextDecoder("utf-8").decode(files[name]);
}

export function parseExport(input: { fileName: string; bytes: Uint8Array }): ChatLine[] {
  const out: ChatLine[] = [];
  let current: ChatLine | null = null;
  let skipping = false;

  for (const rawLine of readText(input).replace(/^﻿/, "").split(/\r?\n/)) {
    const line = rawLine.replace(/^[‎‏]+/, "").replace(NARROW_SPACES, " ");
    const m = line.match(ANDROID) ?? line.match(IPHONE);
    if (!m) {
      // Continuação da mensagem anterior (mensagem com várias linhas).
      if (current && !skipping) current.text += "\n" + rawLine.replace(INVISIBLE, "").replace(NARROW_SPACES, " ");
      continue;
    }
    const [, d, mo, y, h, mi, s, rest] = m;
    current = null;
    skipping = true;
    const sep = rest.indexOf(": ");
    if (sep <= 0) continue; // linha de sistema sem autor
    const author = rest.slice(0, sep).replace(INVISIBLE, "").trim();
    const body = rest.slice(sep + 2);
    // No iPhone, avisos do sistema e mídia vêm com uma marca invisível no começo do texto.
    if (/^[‎‏]/.test(body)) continue;
    const text = body.replace(INVISIBLE, "").trim();
    if (!text || SKIPPED.some((k) => text.toLowerCase().includes(k))) continue;
    current = { at: toDate(d, mo, y, h, mi, s), author, text };
    skipping = false;
    out.push(current);
  }
  for (const l of out) l.text = l.text.trim();
  return out;
}

export function listAuthors(lines: ChatLine[]): { author: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const l of lines) counts.set(l.author, (counts.get(l.author) ?? 0) + 1);
  return [...counts.entries()]
    .map(([author, count]) => ({ author, count }))
    .sort((a, b) => b.count - a.count || a.author.localeCompare(b.author, "pt-BR"));
}
