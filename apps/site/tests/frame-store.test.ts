import { describe, expect, it, vi } from "vitest";
import { FrameStore } from "../src/lib/frames/frame-store";
import type { FrameManifest } from "../src/lib/frames/manifest";

const manifest: FrameManifest = {
  id: "v1",
  frames: 119,
  tiers: { desktop: { width: 1920, height: 1072 }, mobile: { width: 960, height: 536 } },
  pathPattern: "/frames/v1/{tier}/{n}.webp",
  focus: [{ at: 0, x: 0.5, y: 0.5 }],
};

type FakeBitmap = ImageBitmap & { url: string; close: ReturnType<typeof vi.fn> };

/** Loja com rede e decodificador falsos: o blob carrega a própria URL e o bitmap a devolve. */
function setup(opts: { windowSize?: number; stride?: 1 | 2; failUrl?: (url: string, call: number) => boolean; onDecoded?: (index: number) => void } = {}) {
  const urls: string[] = [];
  let calls = 0;
  const fetchImpl = vi.fn(async (url: string) => {
    urls.push(url);
    if (opts.failUrl?.(url, ++calls)) throw new Error("rede caiu");
    return { ok: true, blob: async () => new Blob([url]) } as Response;
  });
  const decode = vi.fn(async (blob: Blob) => {
    const url = await blob.text();
    return { url, width: 1, height: 1, close: vi.fn() } as unknown as FakeBitmap;
  });
  const store = new FrameStore(manifest, "desktop", {
    windowSize: opts.windowSize,
    stride: opts.stride,
    onDecoded: opts.onDecoded,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    decode,
  });
  return { store, urls, fetchImpl, decode };
}

const indexOf = (url: string) => Number(url.match(/(\d{4})\.webp$/)![1]) - 1;
const decodedCount = (store: FrameStore) => Array.from({ length: manifest.frames }, (_, i) => store.get(i)).filter(Boolean).length;

describe("FrameStore.request", () => {
  it("loads from the center outward: 60, 61, 59, 62, 58", async () => {
    const { store, urls } = setup();
    store.request(60);
    await store.idle();
    expect(urls.slice(0, 5).map(indexOf)).toEqual([60, 61, 59, 62, 58]);
  });

  it("builds URLs from the manifest pattern, tier and 1-based 4-digit numbers", async () => {
    const { store, urls } = setup({ windowSize: 1 });
    store.request(0);
    await store.idle();
    expect(urls).toEqual(["/frames/v1/desktop/0001.webp"]);
  });

  it("only keeps a sliding window of decoded bitmaps and closes the ones that leave it", async () => {
    const { store } = setup({ windowSize: 4 });
    store.request(60);
    await store.idle();
    expect(decodedCount(store)).toBe(4);
    const at60 = store.get(60) as FakeBitmap;

    store.request(100);
    await store.idle();
    expect(decodedCount(store)).toBe(4);
    expect(store.get(60)).toBeNull();
    expect(at60.close).toHaveBeenCalledTimes(1);
    expect(store.get(100)).not.toBeNull();
  });

  it("re-decodes a frame that re-enters the window without fetching it again", async () => {
    const { store, urls } = setup({ windowSize: 1 });
    store.request(60);
    await store.idle();
    store.request(100);
    await store.idle();
    store.request(60);
    await store.idle();
    expect(urls.filter((u) => indexOf(u) === 60)).toHaveLength(1);
    expect(store.get(60)).not.toBeNull();
  });

  it("with stride 2 only loads even indices", async () => {
    const { store, urls } = setup({ stride: 2, windowSize: 6 });
    store.request(60);
    await store.idle();
    expect(urls.map(indexOf).every((i) => i % 2 === 0)).toBe(true);
    expect(urls.map(indexOf)).toEqual([60, 62, 58, 64, 56, 66]);
  });

  it("retries a frame whose download failed on the next request", async () => {
    const { store } = setup({ windowSize: 1, failUrl: (_url, call) => call === 1 });
    store.request(10);
    await store.idle();
    expect(store.get(10)).toBeNull();
    store.request(10);
    await store.idle();
    expect(store.get(10)).not.toBeNull();
  });
});

describe("FrameStore onDecoded", () => {
  it("tells the owner which frame just became drawable, so a late frame can be painted", async () => {
    const seen: number[] = [];
    const { store } = setup({ windowSize: 2, onDecoded: (i) => seen.push(i) });
    store.request(30);
    await store.idle();
    expect(seen.sort((a, b) => a - b)).toEqual([30, 31]);
  });
});

describe("FrameStore.nearest (jumps in scroll)", () => {
  it("never returns null once a poster exists: falls back to the poster while frames load", () => {
    const { store } = setup();
    const poster = { url: "poster", width: 1, height: 1, close: vi.fn() } as unknown as ImageBitmap;
    store.setPoster(0, poster);
    expect(store.nearest(90)).toEqual({ index: 0, bitmap: poster });
  });

  it("returns the closest loaded frame once it arrives", async () => {
    const { store } = setup({ windowSize: 1 });
    const poster = { url: "poster", width: 1, height: 1, close: vi.fn() } as unknown as ImageBitmap;
    store.setPoster(0, poster);
    store.request(88);
    await store.idle();
    expect(store.nearest(90)?.index).toBe(88);
  });

  it("returns null when nothing is loaded and there is no poster", () => {
    expect(setup().store.nearest(10)).toBeNull();
  });

  it("keeps the poster alive when the window moves away", async () => {
    const { store } = setup({ windowSize: 1 });
    const poster = { url: "poster", width: 1, height: 1, close: vi.fn() } as unknown as FakeBitmap;
    store.setPoster(0, poster);
    store.request(100);
    await store.idle();
    expect(poster.close).not.toHaveBeenCalled();
    expect(store.get(0)).toBe(poster);
  });
});

describe("FrameStore.dispose", () => {
  it("closes every decoded bitmap", async () => {
    const { store } = setup({ windowSize: 3 });
    store.request(50);
    await store.idle();
    const held = [49, 50, 51].map((i) => store.get(i) as FakeBitmap);
    store.dispose();
    held.forEach((b) => expect(b.close).toHaveBeenCalledTimes(1));
    expect(store.nearest(50)).toBeNull();
  });
});
