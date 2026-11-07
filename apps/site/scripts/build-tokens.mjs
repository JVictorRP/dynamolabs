import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Tokens legados do design system: não devem virar utilitários do site. */
const LEGACY = new Set(["photo-indigo", "photo-azure", "neon-cyan"]);

/** Valor "plano" de cor: hex ou rgb()/rgba(). Aliases ({teal}) e valores por tema (objeto) ficam de fora. */
const isPlainColor = (value) => typeof value === "string" && /^(#|rgba?\()/.test(value.trim());

/**
 * Converte design/tokens.json (design system Dynamo Labs) em um bloco `@theme` do Tailwind 4.
 * @param {{ color: { tokens: { name: string; value: unknown }[] } }} tokens
 * @returns {string}
 */
export function buildTokensCss(tokens) {
  const lines = tokens.color.tokens
    .filter((t) => !LEGACY.has(t.name) && isPlainColor(t.value))
    .map((t) => `  --color-${t.name}: ${String(t.value).trim()};`);
  return ["/* Gerado por scripts/build-tokens.mjs a partir de design/tokens.json. Não editar. */", "@theme {", ...lines, "}", ""].join("\n");
}

const here = dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const tokens = JSON.parse(readFileSync(resolve(here, "../design/tokens.json"), "utf8"));
  const out = resolve(here, "../src/styles/tokens.css");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buildTokensCss(tokens));
  console.log(`tokens.css escrito em ${out}`);
}
