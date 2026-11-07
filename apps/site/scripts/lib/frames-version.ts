import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** Id curto (10 hex) calculado sobre os bytes de todos os arquivos, na ordem dada: muda se qualquer byte mudar. */
export function framesVersion(files: Uint8Array[]): string {
  const hash = createHash("sha1");
  for (const file of files) {
    hash.update(String(file.byteLength));
    hash.update(file);
  }
  return hash.digest("hex").slice(0, 10);
}

/**
 * Carimba `public/frames/<id>/manifest.json` com a versão dos frames e a põe na URL (`?v=`). Assim os frames podem
 * ficar em cache imutável por um ano sem que um reencode, uma contagem nova ou outro recorte fique preso no navegador.
 */
export function stampManifest(framesRoot: string, id: string): string {
  const dir = resolve(framesRoot, id);
  const files: Uint8Array[] = [];
  for (const sub of ["desktop", "mobile"]) {
    for (const name of readdirSync(resolve(dir, sub)).filter((f) => f.endsWith(".webp")).sort()) files.push(readFileSync(resolve(dir, sub, name)));
  }
  for (const name of readdirSync(dir).filter((f) => /^poster-.*\.webp$/.test(f)).sort()) files.push(readFileSync(resolve(dir, name)));

  const manifestPath = resolve(dir, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const version = framesVersion(files);
  manifest.version = version;
  manifest.pathPattern = `/frames/${id}/{tier}/{n}.webp?v=${version}`;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  return version;
}
