/**
 * Quanto cada seção seguinte se sobrepõe à anterior (em svh): antes de a anterior acabar de rolar, o topo da próxima já
 * aparece na parte de baixo da tela. É margem negativa no contêiner do palco, então o comprimento de rolagem de cada
 * palco não muda e o documento já nasce com a altura certa (sem layout shift).
 */
export const STAGE_OVERLAP_VH = 26;

/** Altura (svh) do degradê suave acima do topo da seção que chega. */
export const EDGE_SOFTNESS_VH = 9;
