import { randomUUID } from "node:crypto";
import { FileError } from "./errors";
import { KEY_RE, type ContentStorage } from "./storage";

export { FileError } from "./errors";

export const LIMITS = { image: 10 * 1024 * 1024, video: 200 * 1024 * 1024 } as const;
export type Limits = { image: number; video: number };
export type Kind = { kind: "image" | "video"; ext: "jpg" | "png" | "webp" | "mp4"; mime: string };

const MIME: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", mp4: "video/mp4" };

/** Tipo pelo conteúdo (primeiros bytes): a extensão e o Content-Type que o navegador mandou não valem. */
export function detectKind(head: Uint8Array): Kind | null {
  const is = (offset: number, ...b: number[]) => b.every((v, i) => head[offset + i] === v);
  if (head.length >= 3 && is(0, 0xff, 0xd8, 0xff)) return { kind: "image", ext: "jpg", mime: "image/jpeg" };
  if (head.length >= 8 && is(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { kind: "image", ext: "png", mime: "image/png" };
  if (head.length >= 12 && is(0, 0x52, 0x49, 0x46, 0x46) && is(8, 0x57, 0x45, 0x42, 0x50)) return { kind: "image", ext: "webp", mime: "image/webp" };
  if (head.length >= 12 && is(4, 0x66, 0x74, 0x79, 0x70)) return { kind: "video", ext: "mp4", mime: "video/mp4" };
  return null;
}

/** Lê o começo do corpo (pelo menos 12 bytes) e devolve um fluxo que repete o que já foi lido e segue com o resto. */
async function peek(body: ReadableStream<Uint8Array>, need = 12) {
  const reader = body.getReader();
  const buffered: Uint8Array[] = [];
  let length = 0;
  let ended = false;
  while (length < need && !ended) {
    const { done, value } = await reader.read();
    if (done) ended = true;
    else {
      buffered.push(value);
      length += value.byteLength;
    }
  }
  const head = new Uint8Array(length);
  let offset = 0;
  for (const c of buffered) {
    head.set(c, offset);
    offset += c.byteLength;
  }
  let first = true;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (first) {
        first = false;
        if (head.length) return controller.enqueue(head);
      }
      if (ended) return controller.close();
      const { done, value } = await reader.read();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    cancel: (reason) => reader.cancel(reason),
  });
  return { head, stream };
}

/** Recebe um envio: confere o tipo pelos bytes e o tamanho (com e sem Content-Length) e grava no armazenamento. */
export async function saveUpload(
  storage: ContentStorage,
  input: { organizationId: string; body: ReadableStream<Uint8Array> | null; contentLength: number | null; limits?: Limits },
): Promise<{ key: string; kind: "image" | "video"; mime: string; bytes: number }> {
  const limits = input.limits ?? LIMITS;
  if (!input.body) throw new FileError("vazio", "Nenhum arquivo foi enviado.");
  const { head, stream } = await peek(input.body);
  if (head.length === 0) {
    await stream.cancel().catch(() => {});
    throw new FileError("vazio", "O arquivo está vazio.");
  }
  const found = detectKind(head);
  if (!found) {
    await stream.cancel().catch(() => {});
    throw new FileError("tipo", "Formato não aceito. Envie JPG, PNG, WebP ou vídeo MP4.");
  }
  const max = limits[found.kind];
  if (input.contentLength !== null && input.contentLength > max) {
    await stream.cancel().catch(() => {});
    throw new FileError("tamanho", `O arquivo passa do limite de ${found.kind === "image" ? "10 MB" : "200 MB"} para ${found.kind === "image" ? "imagens" : "vídeos"}.`);
  }
  const key = `${randomUUID()}.${found.ext}`;
  const { bytes } = await storage.put(input.organizationId, key, stream, { maxBytes: max });
  return { key, kind: found.kind, mime: found.mime, bytes };
}

/** A resposta de "não existe", idêntica para arquivo inexistente, de outra empresa ou de link inválido. */
export function neutralNotFound(): Response {
  return new Response(null, { status: 404, headers: { "cache-control": "no-store" } });
}

type ParsedRange = { start: number; end: number } | "invalid";

function parseRange(header: string, size: number): ParsedRange {
  const m = header.match(/^bytes=(\d*)-(\d*)$/);
  if (!m || (m[1] === "" && m[2] === "")) return "invalid";
  if (m[1] === "") {
    const suffix = Number(m[2]);
    if (suffix === 0) return "invalid";
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(m[1]);
  const end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (start >= size || end < start) return "invalid";
  return { start, end };
}

/** Entrega um arquivo (inteiro ou parte dele, para o player de vídeo). Chave inválida ou ausente: 404 neutra. */
export async function serveFile(storage: ContentStorage, input: { organizationId: string; key: string; range: string | null }): Promise<Response> {
  if (!KEY_RE.test(input.key)) return neutralNotFound();
  let info: { size: number } | null;
  try {
    info = await storage.stat(input.organizationId, input.key);
  } catch (e) {
    if (e instanceof FileError) return neutralNotFound();
    throw e;
  }
  if (!info) return neutralNotFound();
  const { size } = info;
  const ext = input.key.split(".").pop() as string;
  const headers: Record<string, string> = {
    "content-type": MIME[ext],
    "accept-ranges": "bytes",
    "x-content-type-options": "nosniff",
    "cache-control": "private, max-age=3600",
  };
  if (input.range === null) {
    const opened = await storage.open(input.organizationId, input.key);
    if (!opened) return neutralNotFound();
    return new Response(opened.stream, { status: 200, headers: { ...headers, "content-length": String(size) } });
  }
  const range = parseRange(input.range, size);
  if (range === "invalid") return new Response(null, { status: 416, headers: { ...headers, "content-range": `bytes */${size}` } });
  const opened = await storage.open(input.organizationId, input.key, range);
  if (!opened) return neutralNotFound();
  return new Response(opened.stream, {
    status: 206,
    headers: { ...headers, "content-range": `bytes ${range.start}-${range.end}/${size}`, "content-length": String(range.end - range.start + 1) },
  });
}
