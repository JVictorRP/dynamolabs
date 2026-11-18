/**
 * Tamanho da fonte do valor de um cartão: grande para números, menor para palavras longas ("Com problema"),
 * proporcional à largura do cartão (unidade cqw, o cartão é um container). 0,72 em ≈ largura média de uma letra
 * da fonte de títulos em caixa alta.
 */
export function statFontSize(value: string): string {
  const cqw = 100 / (0.72 * Math.max(value.length, 1));
  return `min(2.25rem, max(1.1rem, ${cqw.toFixed(1)}cqw))`;
}
