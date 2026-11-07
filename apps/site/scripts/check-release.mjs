#!/usr/bin/env node
/** `pnpm --filter site check:release`: sai com erro enquanto houver pendências para publicar o site. */
import { checkRelease } from "./lib/check-release.ts";
import { COPY } from "../src/content/copy.ts";
import { LEGAL } from "../src/content/legal.ts";

const problems = checkRelease(process.env, COPY.status, LEGAL.status);
if (problems.length === 0) {
  console.log("Pronto para publicar: nenhuma pendência.");
} else {
  console.error(`Não publique ainda. ${problems.length} pendência(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
