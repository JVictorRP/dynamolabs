import { describe, expect, it } from "vitest";
import {
  STATUS_LABEL,
  carouselImages,
  daysLeft,
  formatScheduled,
  gridBadge,
  gridThumb,
  reelsParts,
  toPreviewPost,
  truncateCaption,
  type PreviewPost,
} from "../src/components/content/preview-model";

const media = (over: Partial<PreviewPost["media"][number]> & { fileKey: string }) => ({ id: over.fileKey, kind: "image" as const, isCover: false, alt: null, ...over });
const post = (over: Partial<PreviewPost> = {}): PreviewPost => ({
  id: "p1",
  format: "feed",
  status: "em_aprovacao",
  title: null,
  caption: null,
  scheduledAt: null,
  approvedAt: null,
  daysLeft: null,
  media: [],
  ...over,
});

describe("truncateCaption", () => {
  it("cuts at a whole word and marks truncated", () => {
    const text = "Aproveite a promoção de novembro com desconto em todos os produtos da loja e frete grátis para todo o Brasil neste mês inteiro";
    const r = truncateCaption(text, 60);
    expect(r.truncated).toBe(true);
    expect(r.visible.length).toBeLessThanOrEqual(60);
    expect(text.startsWith(r.visible)).toBe(true);
    expect(text[r.visible.length]).toBe(" "); // parou no fim de uma palavra
  });
  it("keeps short and empty captions intact", () => {
    expect(truncateCaption("Oi!", 125)).toEqual({ visible: "Oi!", truncated: false });
    expect(truncateCaption("", 125)).toEqual({ visible: "", truncated: false });
    expect(truncateCaption(null)).toEqual({ visible: "", truncated: false });
  });
  it("shows at most three lines, like the app", () => {
    const r = truncateCaption("um\ndois\ntrês\nquatro\ncinco", 500);
    expect(r).toEqual({ visible: "um\ndois\ntrês", truncated: true });
  });
  it("cuts a single very long word", () => {
    const r = truncateCaption("x".repeat(300), 125);
    expect(r.truncated).toBe(true);
    expect(r.visible).toHaveLength(125);
  });
});

describe("labels and days", () => {
  it("STATUS_LABEL covers every status", () => {
    for (const s of ["rascunho", "em_aprovacao", "ajuste_pedido", "aprovado", "agendado", "publicado"]) expect(STATUS_LABEL[s], s).toBeTruthy();
  });
  it("daysLeft counts whole days from the 3-day window and never goes negative", () => {
    const t0 = new Date("2026-11-10T12:00:00Z");
    expect(daysLeft(null, t0)).toBeNull();
    expect(daysLeft(t0, t0)).toBe(3);
    expect(daysLeft(t0, new Date(t0.getTime() + 100 * 3600_000))).toBe(0);
  });
  it("formatScheduled uses São Paulo time in Portuguese", () => {
    expect(formatScheduled(null)).toBe("");
    expect(formatScheduled("2026-11-12T01:30:00Z")).toMatch(/11 de nov/); // 22h30 de 11/11 em São Paulo
  });
});

describe("media helpers", () => {
  it("the grid thumbnail is the first image of a feed post and the cover of a reels", () => {
    expect(gridThumb(post({ media: [media({ fileKey: "a.jpg" }), media({ fileKey: "b.jpg", position: 1 } as never)] }))).toEqual({ fileKey: "a.jpg", isVideo: false, alt: null });
    const reels = post({ format: "reels", media: [media({ fileKey: "v.mp4", kind: "video" }), media({ fileKey: "c.jpg", isCover: true })] });
    expect(gridThumb(reels)).toEqual({ fileKey: "c.jpg", isVideo: false, alt: null });
  });
  it("a reels without cover falls back to the video, and an empty post has no thumbnail", () => {
    expect(gridThumb(post({ format: "reels", media: [media({ fileKey: "v.mp4", kind: "video" })] }))).toEqual({ fileKey: "v.mp4", isVideo: true, alt: null });
    expect(gridThumb(post())).toBeNull();
  });
  it("carouselImages excludes covers and keeps the order; reelsParts splits video and cover", () => {
    const p = post({ format: "carrossel", media: [media({ fileKey: "1.jpg" }), media({ fileKey: "2.png" })] });
    expect(carouselImages(p).map((m) => m.fileKey)).toEqual(["1.jpg", "2.png"]);
    const r = post({ format: "reels", media: [media({ fileKey: "v.mp4", kind: "video" }), media({ fileKey: "c.jpg", isCover: true })] });
    expect(reelsParts(r)).toEqual({ video: expect.objectContaining({ fileKey: "v.mp4" }), cover: expect.objectContaining({ fileKey: "c.jpg" }) });
    expect(reelsParts(post({ format: "reels" }))).toEqual({ video: null, cover: null });
  });
  it("for the client the internal title never leaves the server; for the team it stays", () => {
    const base = { id: "x", format: "feed", status: "em_aprovacao", title: "v3 — cliente pediu mais claro, de novo", caption: "Legenda pública", scheduledAt: null, approvedAt: null, daysLeft: null, media: [] } as never;
    expect(toPreviewPost(base, { forClient: true }).title).toBeNull();
    expect(JSON.stringify(toPreviewPost(base, { forClient: true }))).not.toContain("cliente pediu");
    expect(toPreviewPost(base, { forClient: true }).caption).toBe("Legenda pública");
    expect(toPreviewPost(base).title).toBe("v3 — cliente pediu mais claro, de novo");
  });

  it("grid badges are short enough for the cell (no cut-off labels)", () => {
    expect(gridBadge("ajuste_pedido", "client")).toBe("Ajuste");
    expect(gridBadge("em_aprovacao", "client")).toBe("Para aprovar");
    expect(gridBadge("agendado", "client")).toBe("Aprovado");
    expect(gridBadge("publicado", "client")).toBe("Aprovado");
    expect(gridBadge("ajuste_pedido", "staff")).toBe("Ajuste");
    expect(gridBadge("agendado", "staff")).toBe("Agendado");
    expect(gridBadge("rascunho", "staff")).toBe("Rascunho");
    for (const status of Object.keys(STATUS_LABEL)) expect(gridBadge(status, "staff").length, status).toBeLessThanOrEqual(12);
  });

  it("toPreviewPost turns dates into ISO strings and keeps the media order", () => {
    const d = new Date("2026-11-10T12:00:00Z");
    const out = toPreviewPost({
      id: "x", format: "carrossel", status: "aprovado", title: "T", caption: "C", scheduledAt: d, approvedAt: d, daysLeft: 2,
      media: [
        { id: "m2", kind: "image", position: 1, fileKey: "2.jpg", isCover: false, alt: null },
        { id: "m1", kind: "image", position: 0, fileKey: "1.jpg", isCover: false, alt: "um" },
      ],
    } as never);
    expect(out.scheduledAt).toBe(d.toISOString());
    expect(out.approvedAt).toBe(d.toISOString());
    expect(out.media.map((m) => m.fileKey)).toEqual(["1.jpg", "2.jpg"]);
    expect(out.daysLeft).toBe(2);
  });
});
