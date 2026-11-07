#!/usr/bin/env node
/** Recalcula a versão dos frames de cada vídeo e a grava no manifest (use depois de mexer em frames ou pôsteres à mão). */
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stampManifest } from "./lib/frames-version.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../public/frames");
for (const id of readdirSync(root).filter((d) => /^v\d+$/.test(d))) {
  console.log(`${id}: versão ${stampManifest(root, id)}`);
}
