#!/usr/bin/env node
/**
 * Vídeo → frames WebP + manifest.json, para o scrub por scroll.
 *
 *   node scripts/build-frames.mjs --id v1 --input <video> --focus '<json>' [--upscale]
 *
 * - Descarta o quadro com a moldura vermelha do gerador (e os seguintes).
 * - `--upscale`: amplia 720p para 1080p com nitidez (vídeo de menor resolução).
 * - Grão fino só de luminância (uniformiza os dois vídeos e disfarça a diferença de resolução).
 * - Duas larguras: 1920 (desktop) e 960 (mobile). Nomes 0001.webp… (1-based).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isRedBoxFrame, selectFrames } from "./lib/frame-plan.ts";
import { stampManifest } from "./lib/frames-version.ts";

const here = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(here, "..");
const GRAIN = "noise=c0s=7:c0f=t+u:c1s=0:c2s=0";
const SCAN_TAIL = 12; // quantos quadros finais examinar à procura da moldura

function parseArgs(argv) {
  const args = { upscale: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--upscale") args.upscale = true;
    else if (a.startsWith("--")) args[a.slice(2)] = argv[++i];
  }
  if (!["v1", "v2"].includes(args.id) || !args.input || !args.focus) {
    console.error("uso: build-frames.mjs --id v1|v2 --input <video> --focus '<json>' [--upscale]");
    process.exit(2);
  }
  return args;
}

function run(cmd, cmdArgs, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, { maxBuffer: 1024 * 1024 * 512, ...opts });
  if (r.status !== 0) throw new Error(`${cmd} falhou:\n${r.stderr?.toString().slice(-2000)}`);
  return r.stdout;
}

function probe(file, entries, extra = []) {
  const out = run("ffprobe", ["-v", "error", "-select_streams", "v:0", ...extra, "-show_entries", `stream=${entries}`, "-of", "json", file]);
  return JSON.parse(out.toString()).streams[0];
}

/** Primeiro índice (absoluto) entre os últimos quadros que contém a moldura vermelha, ou null. */
function findRedBoxFrame(input, total, width, height) {
  const start = Math.max(0, total - SCAN_TAIL);
  const raw = run("ffmpeg", ["-v", "error", "-i", input, "-vf", `select='gte(n,${start})'`, "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
  const size = width * height * 3;
  for (let i = 0; i * size + size <= raw.length; i++) {
    const frame = new Uint8Array(raw.buffer, raw.byteOffset + i * size, size);
    if (isRedBoxFrame(frame, width, height)) return start + i;
  }
  return null;
}

function encodeTier({ input, outDir, keep, upscale, tierWidth }) {
  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(outDir)) if (f.endsWith(".webp")) rmSync(resolve(outDir, f));
  const base = upscale ? "scale=1920:1080:flags=lanczos,unsharp=5:5:0.8:5:5:0.0" : "scale=1920:-2:flags=lanczos";
  const chain = [`select='lt(n,${keep})'`, base, tierWidth === 960 ? "scale=960:-2:flags=lanczos" : null, GRAIN].filter(Boolean).join(",");
  run("ffmpeg", ["-v", "error", "-y", "-i", input, "-vf", chain, "-fps_mode", "passthrough", "-c:v", "libwebp", "-quality", "80", resolve(outDir, "%04d.webp")]);
  const files = readdirSync(outDir).filter((f) => f.endsWith(".webp")).sort();
  const height = probe(resolve(outDir, files[0]), "height").height;
  const bytes = files.reduce((sum, f) => sum + statSync(resolve(outDir, f)).size, 0);
  return { count: files.length, height, bytes };
}

const args = parseArgs(process.argv.slice(2));
const input = resolve(args.input);
const { width, height, nb_read_frames } = probe(input, "width,height,nb_read_frames", ["-count_frames"]);
const total = Number(nb_read_frames);
const dropFrom = findRedBoxFrame(input, total, width, height);
const keep = selectFrames(total, dropFrom).length;
console.log(`${args.id}: ${total} frames lidos, moldura vermelha ${dropFrom === null ? "não encontrada" : `a partir do índice ${dropFrom}`} → ${keep} mantidos`);

const root = resolve(siteRoot, "public/frames", args.id);
const desktop = encodeTier({ input, outDir: resolve(root, "desktop"), keep, upscale: args.upscale, tierWidth: 1920 });
const mobile = encodeTier({ input, outDir: resolve(root, "mobile"), keep, upscale: args.upscale, tierWidth: 960 });
if (desktop.count !== keep || mobile.count !== keep) throw new Error(`contagem inesperada: desktop ${desktop.count}, mobile ${mobile.count}, esperado ${keep}`);

// Pôsteres leves do primeiro frame (embutidos no HTML da página): menores e mais comprimidos que os frames cheios.
for (const [tier, width] of [["desktop", 1280], ["mobile", 640]]) {
  run("ffmpeg", ["-v", "error", "-y", "-i", resolve(root, tier, "0001.webp"), "-vf", `scale=${width}:-2`, "-c:v", "libwebp", "-quality", "55", resolve(root, `poster-${tier}.webp`)]);
}

const manifest = {
  id: args.id,
  frames: keep,
  tiers: { desktop: { width: 1920, height: desktop.height }, mobile: { width: 960, height: mobile.height } },
  pathPattern: `/frames/${args.id}/{tier}/{n}.webp`,
  focus: JSON.parse(args.focus),
};
writeFileSync(resolve(root, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
// Carimba a versão dos frames no manifest e na URL (cache imutável sem arquivos antigos presos no navegador).
const version = stampManifest(resolve(siteRoot, "public/frames"), args.id);
const mb = (n) => (n / 1024 / 1024).toFixed(1);
console.log(`${args.id}: versão ${version} · desktop ${mb(desktop.bytes)} MB · mobile ${mb(mobile.bytes)} MB → ${resolve(root, "manifest.json")}`);
