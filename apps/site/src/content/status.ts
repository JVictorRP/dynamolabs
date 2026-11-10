import type { Lang, Status } from "@/lib/i18n/config";
import { LANGS, publishedLangs, showAllLanguages } from "@/lib/i18n/config";
import { getCopy } from "./copy/index";
import { getLegal } from "./legal/index";

/** Estado de aprovação de cada idioma: copy e textos legais. Um idioma só vai ao ar com os dois "final". */
export function statusByLang(): Record<Lang, { copy: Status; legal: Status }> {
  return Object.fromEntries(LANGS.map((lang) => [lang, { copy: getCopy(lang).status, legal: getLegal(lang).status }])) as Record<Lang, { copy: Status; legal: Status }>;
}

/** Idiomas no ar neste build: os aprovados (e todos, em `next dev` e no build de teste). Calculado no servidor. */
export function activeLangs(): Lang[] {
  return publishedLangs(statusByLang(), showAllLanguages());
}
