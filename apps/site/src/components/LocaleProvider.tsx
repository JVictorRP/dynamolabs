"use client";

import { createContext, useContext } from "react";
import { getCopy, type Copy } from "@/content/copy/index";
import type { Lang, PageKey } from "@/lib/i18n/config";

type Locale = { lang: Lang; page: PageKey; languages: readonly Lang[]; copy: Copy };

const LocaleContext = createContext<Locale | null>(null);

/**
 * Idioma da página para os componentes de cliente. `languages` (os idiomas no ar) vem calculado do servidor: assim o menu
 * e o HTML concordam, sem depender de variáveis de ambiente lidas no navegador.
 */
export function LocaleProvider({ lang, page, languages, children }: { lang: Lang; page: PageKey; languages: readonly Lang[]; children: React.ReactNode }) {
  return <LocaleContext.Provider value={{ lang, page, languages, copy: getCopy(lang) }}>{children}</LocaleContext.Provider>;
}

function useLocale(): Locale {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("Este componente precisa estar dentro de <LocaleProvider> (idioma da página).");
  return value;
}

export const useCopy = (): Copy => useLocale().copy;
export const useLang = (): Lang => useLocale().lang;
export const usePageKey = (): PageKey => useLocale().page;
export const useLanguages = (): readonly Lang[] => useLocale().languages;
