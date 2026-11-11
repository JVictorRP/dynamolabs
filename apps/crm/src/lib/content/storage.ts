/**
 * Armazenamento dos arquivos do conteúdo no disco do VPS (volume do Easypanel montado em /data).
 * Atrás de uma interface, para trocar por um armazenamento S3 depois sem refazer as telas.
 */
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { FileError } from "./errors";

export interface ContentStorage {
  put(organizationId: string, key: string, data: ReadableStream<Uint8Array>, opts: { maxBytes: number }): Promise<{ bytes: number }>;
  stat(organizationId: string, key: string): Promise<{ size: number } | null>;
  open(organizationId: string, key: string, range?: { start: number; end: number }): Promise<{ stream: ReadableStream<Uint8Array>; size: number } | null>;
  remove(organizationId: string, key: string): Promise<void>;
  /** Bytes usados por uma empresa, ou por todas se `organizationId` for omitido. */
  usage(organizationId?: string): Promise<number>;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const ORG_RE = new RegExp(`^${UUID}$`);
export const KEY_RE = new RegExp(`^${UUID}\\.(jpg|png|webp|mp4)$`);

function check(organizationId: string, key?: string) {
  if (!ORG_RE.test(organizationId)) throw new FileError("chave", "Empresa inválida para o arquivo.");
  if (key !== undefined && !KEY_RE.test(key)) throw new FileError("chave", "Nome de arquivo inválido.");
}

export function createFsStorage(root: string): ContentStorage {
  const dirOf = (org: string) => join(root, org);
  const isMissing = (e: unknown) => (e as NodeJS.ErrnoException)?.code === "ENOENT";

  return {
    async put(org, key, data, { maxBytes }) {
      check(org, key);
      await mkdir(dirOf(org), { recursive: true });
      const tmp = join(dirOf(org), `.${randomUUID()}.tmp`);
      const out = createWriteStream(tmp, { flags: "wx" });
      let bytes = 0;
      const reader = data.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > maxBytes) throw new FileError("tamanho", "O arquivo passa do tamanho máximo permitido.");
          if (!out.write(value)) await new Promise<void>((resolve, reject) => (out.once("drain", resolve), out.once("error", reject)));
        }
        await new Promise<void>((resolve, reject) => (out.once("error", reject), out.end(resolve)));
        await rename(tmp, join(dirOf(org), key));
        return { bytes };
      } catch (e) {
        // Espera o fluxo de gravação fechar de vez antes de apagar: senão o arquivo pode ser criado depois do rm.
        if (!out.closed) await new Promise<void>((resolve) => (out.once("close", resolve), out.destroy()));
        await reader.cancel().catch(() => {});
        await rm(tmp, { force: true });
        throw e;
      }
    },

    async stat(org, key) {
      check(org, key);
      try {
        return { size: (await stat(join(dirOf(org), key))).size };
      } catch (e) {
        if (isMissing(e)) return null;
        throw e;
      }
    },

    async open(org, key, range) {
      check(org, key);
      const file = join(dirOf(org), key);
      try {
        const { size } = await stat(file);
        const stream = Readable.toWeb(createReadStream(file, range ? { start: range.start, end: range.end } : undefined)) as unknown as ReadableStream<Uint8Array>;
        return { stream, size };
      } catch (e) {
        if (isMissing(e)) return null;
        throw e;
      }
    },

    async remove(org, key) {
      check(org, key);
      await unlink(join(dirOf(org), key)).catch((e) => {
        if (!isMissing(e)) throw e;
      });
    },

    async usage(org) {
      let orgs: string[];
      if (org) {
        check(org);
        orgs = [org];
      } else {
        orgs = (await readdir(root).catch(() => [])).filter((d) => ORG_RE.test(d));
      }
      let total = 0;
      for (const o of orgs) {
        for (const name of await readdir(dirOf(o)).catch(() => [])) {
          if (name.endsWith(".tmp")) continue;
          total += (await stat(join(dirOf(o), name)).catch(() => ({ size: 0 }))).size;
        }
      }
      return total;
    },
  };
}

/** Garante que o diretório existe e aceita gravação; falha com uma mensagem clara (usada na inicialização). */
export async function checkWritable(dir: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true });
    const probe = join(dir, `.write-test-${randomUUID()}`);
    await writeFile(probe, "ok");
    await unlink(probe);
  } catch (e) {
    throw new Error(
      `A pasta de arquivos do conteúdo (${dir}) não aceita gravação: ${(e as Error).message}. Confira o volume montado em /data no Easypanel.`,
    );
  }
}
