/** Atalho do português (padrão) para scripts e testes: `LEGAL.status` do pt. As páginas leem o idioma da rota. */
import { getLegal } from "./legal/index";

export { getLegal, LEGAL_BY_LANG } from "./legal/index";
export type { Legal } from "./legal/index";
export const LEGAL = getLegal("pt");
