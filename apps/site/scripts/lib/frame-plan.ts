/**
 * Índices (0-based) dos frames mantidos: descarta o frame `dropFromIndex` e todos os seguintes.
 * `null` mantém todos.
 */
export function selectFrames(total: number, dropFromIndex: number | null): number[] {
  const end = dropFromIndex === null ? total : Math.min(total, dropFromIndex);
  return Array.from({ length: end }, (_, i) => i);
}

/** Fração mínima de pixels vermelhos puros para considerar que o frame tem a moldura do gerador. */
const RED_FRACTION = 0.0003;

/**
 * Detecta a moldura vermelha que o gerador de vídeo deixa no último quadro.
 * `rgb` é um buffer RGB empacotado (3 bytes por pixel).
 */
export function isRedBoxFrame(rgb: Uint8Array, width: number, height: number): boolean {
  const pixels = width * height;
  let red = 0;
  for (let i = 0; i < pixels; i++) {
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
    if (r > 200 && g < 60 && b < 60) red++;
  }
  return red / pixels > RED_FRACTION;
}
