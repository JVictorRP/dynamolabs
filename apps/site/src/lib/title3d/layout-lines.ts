/** Entrelinha do design system (0,9) e altura de maiúscula da Archivo Black, em em. */
export const LINE_HEIGHT = 0.9;
export const CAP_HEIGHT = 0.72;

/** Altura, em em, de um bloco de título com `lines` linhas: da linha de base da última ao topo das maiúsculas da primeira. */
export function blockHeightEm(lines: number): number {
  return (lines - 1) * LINE_HEIGHT + CAP_HEIGHT;
}

/** Índice (0-based, contando as palavras do texto inteiro) da primeira palavra igual a `word`; -1 se não existir. */
export function wordIndexOf(text: string, word: string): number {
  return text.split(/\s+/).filter(Boolean).indexOf(word);
}

/**
 * Quebra `text` em linhas: respeita `\n` explícitos e, dentro de cada parágrafo, quebra por palavra
 * quando a linha passaria de `maxWidthEm`. Uma palavra maior que o limite fica sozinha (nunca é partida).
 * `measure` devolve a largura de um trecho na mesma unidade de `maxWidthEm`.
 */
export function layoutLines(text: string, maxWidthEm: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && measure(candidate) > maxWidthEm) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}
