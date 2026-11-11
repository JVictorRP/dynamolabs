/**
 * Limites por IP do link público, em janelas de 10 minutos. O código do link tem 144 bits: o limite só precisa
 * deter varredura e abuso, não adivinhação. Arquivos têm uma faixa bem maior porque o iPhone busca o vídeo em
 * muitos pedaços pequenos (Range) e cada imagem da grade conta.
 */
export const LINK_LIMITS = { windowMs: 10 * 60_000, pages: 300, files: 3000, decisions: 20 } as const;
