/**
 * Tamanho de cada título 3D em em (largura da linha mais larga e altura do bloco), medido na Archivo Black.
 * O texto HTML dos palcos usa estes valores desde a primeira pintura; quando o 3D fica pronto ele mede o mesmo e nada
 * salta. `tests/title-sizes.test.ts` confere estes números contra a fonte e a copy: mudou o texto, atualize aqui.
 */
export const TITLE_SIZE_EM = {
  hero: { width: 8.92, height: 1.62 },
  s2: { width: 7.316, height: 2.52 },
  video2: { width: 7.887, height: 2.52 },
} as const;
