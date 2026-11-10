#!/usr/bin/env node
/** `pnpm --filter site check:release`: sai com erro enquanto houver pendências para publicar o site. */
import { checkRelease } from "./lib/check-release.ts";
// O Node carrega estes arquivos direto (sem o alias "@/" nem imports sem extensão): por isso os caminhos completos do pt.
import { pt as COPY } from "../src/content/copy/pt.ts";
import { pt as LEGAL } from "../src/content/legal/pt.ts";

const problems = checkRelease(process.env, COPY.status, LEGAL.status);
if (problems.length === 0) {
  console.log("Pronto para publicar: nenhuma pendência.");
} else {
  console.error(`Não publique ainda. ${problems.length} pendência(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
