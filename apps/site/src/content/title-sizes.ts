import type { Lang } from "@/lib/i18n/config";

type Size = { width: number; height: number };

/**
 * Tamanho de cada título 3D em em (largura da linha mais larga e altura do bloco), medido na Archivo Black, por idioma.
 * O texto HTML dos palcos usa estes valores desde a primeira pintura; quando o 3D fica pronto ele mede o mesmo e nada
 * salta. `tests/title-sizes.test.ts` confere estes números contra a fonte e a copy de cada idioma: mudou o texto,
 * atualize aqui.
 */
export const TITLE_SIZE_EM: Record<Lang, { hero: Size; s2: Size; video2: Size }> = {
  pt: { hero: { width: 8.92, height: 1.62 }, s2: { width: 7.316, height: 2.52 }, video2: { width: 7.887, height: 2.52 } },
  en: { hero: { width: 7.44, height: 1.62 }, s2: { width: 6.444, height: 2.52 }, video2: { width: 6.777, height: 2.52 } },
  es: { hero: { width: 9.198, height: 1.62 }, s2: { width: 7.039, height: 2.52 }, video2: { width: 7.165, height: 2.52 } },
};
