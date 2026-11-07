import { frameUrl, type FrameManifest, type Tier } from "./manifest";

export type { Tier } from "./manifest";

export interface FrameStoreOptions {
  /** Máximo de bitmaps decodificados ao mesmo tempo (padrão 20). */
  windowSize?: number;
  /** 2 = carrega só os índices pares (economia de dados). */
  stride?: 1 | 2;
  fetchImpl?: typeof fetch;
  decode?: (blob: Blob) => Promise<ImageBitmap>;
  /** Chamado quando um frame termina de ser decodificado (permite redesenhar depois de um salto de scroll). */
  onDecoded?: (index: number) => void;
}

const MAX_CONCURRENT = 4;

/**
 * Guarda os frames de um vídeo: os bytes comprimidos de tudo que já foi baixado e, decodificados,
 * só os que estão numa janela ao redor da posição atual (um frame 1920×1080 decodificado pesa ~8 MB).
 */
export class FrameStore {
  private readonly windowSize: number;
  private readonly stride: 1 | 2;
  private readonly fetchImpl: typeof fetch;
  private readonly decode: (blob: Blob) => Promise<ImageBitmap>;
  private readonly onDecoded?: (index: number) => void;

  private readonly blobs = new Map<number, Blob>();
  private readonly bitmaps = new Map<number, ImageBitmap>();
  private readonly pending = new Set<number>();
  private wanted = new Set<number>();
  private queue: number[] = [];
  private active = 0;
  private poster: { index: number; bitmap: ImageBitmap } | null = null;
  private waiters: Array<() => void> = [];
  private disposed = false;

  constructor(
    private readonly manifest: FrameManifest,
    private readonly tier: Tier,
    opts: FrameStoreOptions = {},
  ) {
    this.windowSize = opts.windowSize ?? 20;
    this.stride = opts.stride ?? 1;
    this.fetchImpl = opts.fetchImpl ?? ((url) => fetch(url));
    this.decode = opts.decode ?? ((blob) => createImageBitmap(blob));
    this.onDecoded = opts.onDecoded;
  }

  /** Frame já decodificado que nunca sai da memória (o primeiro, que vem embutido na página). */
  setPoster(index: number, bitmap: ImageBitmap): void {
    this.poster = { index, bitmap };
  }

  /** Muda o centro da janela: libera o que saiu dela e carrega, do centro para fora, o que falta. */
  request(centerIndex: number): void {
    if (this.disposed) return;
    this.wanted = new Set(this.windowIndices(centerIndex));
    for (const [index, bitmap] of this.bitmaps) {
      if (!this.wanted.has(index)) {
        bitmap.close();
        this.bitmaps.delete(index);
      }
    }
    this.queue = [...this.wanted].filter((i) => !this.bitmaps.has(i) && !this.pending.has(i));
    this.pump();
  }

  /** Frame exato, se estiver decodificado. */
  get(index: number): ImageBitmap | null {
    return this.bitmaps.get(index) ?? (this.poster?.index === index ? this.poster.bitmap : null);
  }

  /** Frame decodificado mais próximo de `index` (empate: o mais antigo); `null` se não há nenhum. */
  nearest(index: number): { index: number; bitmap: ImageBitmap } | null {
    let best: { index: number; bitmap: ImageBitmap } | null = null;
    const consider = (i: number, bitmap: ImageBitmap) => {
      if (!best) return void (best = { index: i, bitmap });
      const d = Math.abs(i - index);
      const bd = Math.abs(best.index - index);
      if (d < bd || (d === bd && i < best.index)) best = { index: i, bitmap };
    };
    for (const [i, bitmap] of this.bitmaps) consider(i, bitmap);
    if (this.poster) consider(this.poster.index, this.poster.bitmap);
    return best;
  }

  /** Resolve quando não há nada baixando nem na fila. */
  idle(): Promise<void> {
    if (this.active === 0 && this.queue.length === 0) return Promise.resolve();
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  dispose(): void {
    this.disposed = true;
    for (const bitmap of this.bitmaps.values()) bitmap.close();
    this.poster?.bitmap.close();
    this.bitmaps.clear();
    this.blobs.clear();
    this.poster = null;
    this.queue = [];
    this.wanted.clear();
  }

  private windowIndices(center: number): number[] {
    const { frames } = this.manifest;
    const c = Math.min(Math.max(Math.round(center), 0), frames - 1);
    const ok = (i: number) => i >= 0 && i < frames && i % this.stride === 0;
    const out: number[] = [];
    for (let d = 0; d < frames && out.length < this.windowSize; d++) {
      for (const i of d === 0 ? [c] : [c + d, c - d]) {
        if (ok(i) && out.length < this.windowSize) out.push(i);
      }
    }
    return out;
  }

  private pump(): void {
    while (this.active < MAX_CONCURRENT && this.queue.length > 0) {
      const index = this.queue.shift()!;
      if (!this.wanted.has(index) || this.pending.has(index) || this.bitmaps.has(index)) continue;
      this.pending.add(index);
      this.active++;
      void this.load(index).finally(() => {
        this.pending.delete(index);
        this.active--;
        this.pump();
        this.notifyIfIdle();
      });
    }
    this.notifyIfIdle();
  }

  private notifyIfIdle(): void {
    if (this.active === 0 && this.queue.length === 0) {
      const waiters = this.waiters;
      this.waiters = [];
      waiters.forEach((resolve) => resolve());
    }
  }

  private async load(index: number): Promise<void> {
    try {
      let blob = this.blobs.get(index);
      if (!blob) {
        const res = await this.fetchImpl(frameUrl(this.manifest, this.tier, index));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        blob = await res.blob();
        this.blobs.set(index, blob);
      }
      if (this.disposed || !this.wanted.has(index)) return;
      const bitmap = await this.decode(blob);
      if (this.disposed || !this.wanted.has(index)) return void bitmap.close();
      this.bitmaps.set(index, bitmap);
      this.onDecoded?.(index);
    } catch {
      // O frame fica ausente; a próxima chamada de request() tenta de novo.
    }
  }
}
