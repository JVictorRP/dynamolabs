/** Atalho do português (padrão) para testes e scripts. Os componentes leem o idioma da página (ver LocaleProvider). */
import { COPY_BY_LANG } from "./copy/index";

export { COPY_BY_LANG, getCopy } from "./copy/index";
export type { Copy } from "./copy/index";
export const COPY = COPY_BY_LANG.pt;
