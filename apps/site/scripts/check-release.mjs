#!/usr/bin/env node
/** `pnpm --filter site check:release`: sai com erro enquanto houver pendências para publicar o site (português). */
import { checkRelease, unpublishedLanguages } from "./lib/check-release.ts";
// O Node carrega estes arquivos direto (sem o alias "@/" nem imports sem extensão): por isso os caminhos completos.
import { pt as ptCopy } from "../src/content/copy/pt.ts";
import { en as enCopy } from "../src/content/copy/en.ts";
import { es as esCopy } from "../src/content/copy/es.ts";
import { pt as ptLegal } from "../src/content/legal/pt.ts";
import { en as enLegal } from "../src/content/legal/en.ts";
import { es as esLegal } from "../src/content/legal/es.ts";

const problems = checkRelease(process.env, ptCopy.status, ptLegal.status);

// Idiomas ainda provisórios não travam o lançamento: ficam fora do ar (sem /en e /es) até serem aprovados.
const skipped = unpublishedLanguages({
  pt: { copy: ptCopy.status, legal: ptLegal.status },
  en: { copy: enCopy.status, legal: enLegal.status },
  es: { copy: esCopy.status, legal: esLegal.status },
});
for (const { lang, reason } of skipped) {
  console.warn(`Aviso: o idioma "${lang}" fica fora do ar neste build (${reason}). Aprove os textos e mude os status para "final" para publicá-lo.`);
}

if (problems.length === 0) {
  console.log("Pronto para publicar: nenhuma pendência.");
} else {
  console.error(`Não publique ainda. ${problems.length} pendência(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
