/** Idiomas do site e o que depende só deles (caminhos, lang do HTML, publicação). Funções puras, sem React. */
export type Lang = "pt" | "en" | "es";
export type PageKey = "home" | "privacy" | "terms";
export type Status = "provisional" | "final";

export const LANGS: readonly Lang[] = ["pt", "en", "es"];
export const DEFAULT_LANG: Lang = "pt";

export const HTML_LANG: Record<Lang, string> = { pt: "pt-BR", en: "en", es: "es" };
export const OG_LOCALE: Record<Lang, string> = { pt: "pt_BR", en: "en_US", es: "es_ES" };

const PATHS: Record<Lang, Record<PageKey, string>> = {
  pt: { home: "/", privacy: "/privacidade", terms: "/termos" },
  en: { home: "/en", privacy: "/en/privacy", terms: "/en/terms" },
  es: { home: "/es", privacy: "/es/privacidad", terms: "/es/terminos" },
};

export function isLang(value: string): value is Lang {
  return (LANGS as readonly string[]).includes(value);
}

export function pathFor(lang: Lang, page: PageKey): string {
  return PATHS[lang][page];
}

/** Idiomas no ar: copy e textos legais finais. O padrão (pt) sempre entra; `showAll` (dev e e2e) liga todos. */
export function publishedLangs(statuses: Record<Lang, { copy: Status; legal: Status }>, showAll: boolean): Lang[] {
  if (showAll) return [...LANGS];
  return LANGS.filter((lang) => lang === DEFAULT_LANG || (statuses[lang].copy === "final" && statuses[lang].legal === "final"));
}

/** Idiomas provisórios só existem no `next dev` e nos builds de teste (NEXT_PUBLIC_E2E=1). */
export function showAllLanguages(
  // As duas variáveis são lidas pelo nome: o Next só troca `process.env.NEXT_PUBLIC_X` quando ele aparece assim.
  env: { NODE_ENV?: string; NEXT_PUBLIC_E2E?: string } = { NODE_ENV: process.env.NODE_ENV, NEXT_PUBLIC_E2E: process.env.NEXT_PUBLIC_E2E },
): boolean {
  return env.NEXT_PUBLIC_E2E === "1" || env.NODE_ENV === "development";
}

/** Último trecho do caminho das páginas legais de um idioma (`/en/privacy` → "privacy"); só faz sentido fora do idioma padrão. */
export function legalSlugs(lang: Lang): { slug: string; page: "privacy" | "terms" }[] {
  return (["privacy", "terms"] as const).map((page) => ({ slug: PATHS[lang][page].split("/").pop() as string, page }));
}

/** Página legal que corresponde a um trecho de caminho no idioma, ou null se ele não pertence ao idioma. */
export function pageFromSlug(lang: Lang, slug: string): "privacy" | "terms" | null {
  return legalSlugs(lang).find((entry) => entry.slug === slug)?.page ?? null;
}

/** Há algum idioma além do padrão no ar? Sem isso as rotas `[lang]` não podem existir (export estático exige ao menos uma). */
export function hasExtraLanguages(statuses: Record<Lang, { copy: Status; legal: Status }>, showAll: boolean): boolean {
  return publishedLangs(statuses, showAll).some((lang) => lang !== DEFAULT_LANG);
}
