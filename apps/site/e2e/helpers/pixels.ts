import type { Page } from "@playwright/test";

type Rect = { x: number; y: number; width: number; height: number };

/** Luminância relativa (0–1) da área `rect` numa captura da página: média e um percentil alto. */
export async function lumaStats(page: Page, rect: Rect, percentile = 0.97): Promise<{ mean: number; high: number }> {
  const shot = (await page.screenshot()).toString("base64");
  return page.evaluate(
    async ({ b64, r, q }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const k = img.naturalWidth / window.innerWidth;
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(Math.round(r.x * k), Math.round(r.y * k), Math.round(r.width * k), Math.round(r.height * k));
      const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      const ys: number[] = [];
      for (let i = 0; i < data.length; i += 8) ys.push(0.2126 * lin(data[i]) + 0.7152 * lin(data[i + 1]) + 0.0722 * lin(data[i + 2]));
      ys.sort((a, b) => a - b);
      return { mean: ys.reduce((a, b) => a + b, 0) / ys.length, high: ys[Math.min(ys.length - 1, Math.floor(ys.length * q))] };
    },
    { b64: shot, r: rect, q: percentile },
  );
}
