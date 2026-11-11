import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";
import { createTestDb, seedOrg } from "@dynamo/db/testing";
import { attachMedia, findFileOwner, setAvatar } from "../src/lib/content/media";
import { detectKind, FileError, neutralNotFound, saveUpload, serveFile } from "../src/lib/content/files";
import { checkWritable, createFsStorage, type ContentStorage } from "../src/lib/content/storage";

let db: Db;
let close: () => Promise<void>;
let dir: string;
let storage: ContentStorage;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "dyn-content-"));
  storage = createFsStorage(dir);
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const bytes = (...head: number[]) => (size = 64) => {
  const b = new Uint8Array(Math.max(size, head.length));
  b.set(head);
  return b;
};
const JPG = bytes(0xff, 0xd8, 0xff, 0xe0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);
const MP4 = bytes(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d);
const TEXT = (size = 64) => new TextEncoder().encode("não sou imagem ".repeat(10)).slice(0, size);

/** Corpo em pedaços pequenos (testa a leitura dos primeiros bytes quebrada em vários pedaços). */
function streamOf(data: Uint8Array, chunk = 5): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream({
    pull(c) {
      if (i >= data.length) return c.close();
      c.enqueue(data.slice(i, i + chunk));
      i += chunk;
    },
  });
}
const orgOf = async (name: string) => seedOrg(db, name);
const filesIn = async (org: string) => readdir(join(dir, org)).catch(() => [] as string[]);
async function readAll(res: Response) {
  return new Uint8Array(await res.arrayBuffer());
}

describe("detectKind", () => {
  it("detects jpg, png, webp and mp4 by the first bytes", () => {
    expect(detectKind(JPG())).toMatchObject({ kind: "image", ext: "jpg", mime: "image/jpeg" });
    expect(detectKind(PNG())).toMatchObject({ kind: "image", ext: "png", mime: "image/png" });
    expect(detectKind(WEBP())).toMatchObject({ kind: "image", ext: "webp", mime: "image/webp" });
    expect(detectKind(MP4())).toMatchObject({ kind: "video", ext: "mp4", mime: "video/mp4" });
  });
  it("rejects text, empty and too-short input", () => {
    expect(detectKind(TEXT())).toBeNull();
    expect(detectKind(new Uint8Array())).toBeNull();
    expect(detectKind(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe("saveUpload", () => {
  it("stores an image whose type comes from the bytes, even when everything else lies", async () => {
    const org = await orgOf("Salva");
    const r = await saveUpload(storage, { organizationId: org, body: streamOf(JPG(200)), contentLength: 200 });
    expect(r).toMatchObject({ kind: "image", mime: "image/jpeg", bytes: 200 });
    expect(r.key).toMatch(/^[0-9a-f-]{36}\.jpg$/);
    expect(await filesIn(org)).toEqual([r.key]);
  });

  it("rejects a text file named .jpg", async () => {
    const org = await orgOf("Texto");
    await expect(saveUpload(storage, { organizationId: org, body: streamOf(TEXT()), contentLength: 64 })).rejects.toMatchObject({ code: "tipo" });
    expect(await filesIn(org)).toEqual([]);
  });

  it("rejects an empty body", async () => {
    const org = await orgOf("Vazio");
    await expect(saveUpload(storage, { organizationId: org, body: null, contentLength: null })).rejects.toMatchObject({ code: "vazio" });
    await expect(saveUpload(storage, { organizationId: org, body: streamOf(new Uint8Array()), contentLength: 0 })).rejects.toMatchObject({ code: "vazio" });
  });

  it("rejects an upload above the limit, with and without Content-Length, leaving no file behind", async () => {
    const org = await orgOf("Grande");
    const limits = { image: 100, video: 300 };
    await expect(saveUpload(storage, { organizationId: org, body: streamOf(JPG(500)), contentLength: 500, limits })).rejects.toMatchObject({ code: "tamanho" });
    await expect(saveUpload(storage, { organizationId: org, body: streamOf(JPG(500)), contentLength: null, limits })).rejects.toMatchObject({ code: "tamanho" });
    await expect(saveUpload(storage, { organizationId: org, body: streamOf(JPG(500)), contentLength: 5, limits })).rejects.toMatchObject({ code: "tamanho" }); // Content-Length mentindo
    expect(await filesIn(org)).toEqual([]);
    const video = await saveUpload(storage, { organizationId: org, body: streamOf(MP4(250)), contentLength: 250, limits });
    expect(video.kind).toBe("video"); // o limite do vídeo é maior que o da imagem
  });

  it("removes the partial file when the stream is cut", async () => {
    const org = await orgOf("Cortado");
    let sent = 0;
    const cut = new ReadableStream<Uint8Array>({
      pull(c) {
        if (sent === 0) {
          sent = 1;
          return c.enqueue(JPG(100));
        }
        c.error(new Error("conexão caiu"));
      },
    });
    await expect(saveUpload(storage, { organizationId: org, body: cut, contentLength: null })).rejects.toThrow("conexão caiu");
    expect(await filesIn(org)).toEqual([]);
  });
});

describe("storage keys", () => {
  it("rejects keys with ../ or other organizations' ids", async () => {
    const org = await orgOf("Chaves");
    for (const key of ["../x.jpg", "..%2Fx.jpg", "a/b.jpg", "x.jpg", "00000000-0000-0000-0000-000000000000.exe", ""]) {
      await expect(storage.open(org, key)).rejects.toMatchObject({ code: "chave" });
      await expect(storage.remove(org, key)).rejects.toMatchObject({ code: "chave" });
    }
    await expect(storage.open("../outra", "00000000-0000-0000-0000-000000000000.jpg")).rejects.toMatchObject({ code: "chave" });
    const res = await serveFile(storage, { organizationId: org, key: "../../etc/passwd", range: null });
    expect(res.status).toBe(404);
  });

  it("never serves a file of one organization under another's id", async () => {
    const a = await orgOf("DonoA");
    const b = await orgOf("DonoB");
    const saved = await saveUpload(storage, { organizationId: a, body: streamOf(JPG(50)), contentLength: 50 });
    expect((await serveFile(storage, { organizationId: a, key: saved.key, range: null })).status).toBe(200);
    expect((await serveFile(storage, { organizationId: b, key: saved.key, range: null })).status).toBe(404);
  });

  it("usage sums the bytes of an organization and of everyone", async () => {
    const a = await orgOf("UsoA");
    const b = await orgOf("UsoB");
    await saveUpload(storage, { organizationId: a, body: streamOf(JPG(100)), contentLength: 100 });
    await saveUpload(storage, { organizationId: a, body: streamOf(PNG(50)), contentLength: 50 });
    await saveUpload(storage, { organizationId: b, body: streamOf(JPG(30)), contentLength: 30 });
    expect(await storage.usage(a)).toBe(150);
    expect(await storage.usage()).toBe(180);
    expect(await storage.usage(await orgOf("UsoVazio"))).toBe(0);
  });

  it("checkWritable passes on a writable directory and explains a failure", async () => {
    await checkWritable(dir);
    await writeFile(join(dir, "arquivo"), "x");
    await expect(checkWritable(join(dir, "arquivo", "dentro"))).rejects.toThrow(/gravar|gravação|escrita/i);
  });
});

describe("serveFile and Range", () => {
  async function stored(org: string) {
    const data = JPG(100);
    for (let i = 4; i < 100; i++) data[i] = i;
    const r = await saveUpload(storage, { organizationId: org, body: streamOf(data), contentLength: 100 });
    return { key: r.key, data };
  }

  it("serves the whole file with the safety headers", async () => {
    const org = await orgOf("Inteiro");
    const { key, data } = await stored(org);
    const res = await serveFile(storage, { organizationId: org, key, range: null });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("content-length")).toBe("100");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toMatch(/^private/);
    expect(await readAll(res)).toEqual(data);
  });

  it("Range: bytes=0- returns 206 with the whole file", async () => {
    const org = await orgOf("RangeAberto");
    const { key, data } = await stored(org);
    const res = await serveFile(storage, { organizationId: org, key, range: "bytes=0-" });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 0-99/100");
    expect(await readAll(res)).toEqual(data);
  });

  it("a middle range, a suffix range and an open range work", async () => {
    const org = await orgOf("RangeMeio");
    const { key, data } = await stored(org);
    const mid = await serveFile(storage, { organizationId: org, key, range: "bytes=10-19" });
    expect(mid.status).toBe(206);
    expect(mid.headers.get("content-range")).toBe("bytes 10-19/100");
    expect(mid.headers.get("content-length")).toBe("10");
    expect(await readAll(mid)).toEqual(data.slice(10, 20));
    const suffix = await serveFile(storage, { organizationId: org, key, range: "bytes=-30" });
    expect(suffix.headers.get("content-range")).toBe("bytes 70-99/100");
    expect(await readAll(suffix)).toEqual(data.slice(70));
    const open = await serveFile(storage, { organizationId: org, key, range: "bytes=90-" });
    expect(await readAll(open)).toEqual(data.slice(90));
    const clamped = await serveFile(storage, { organizationId: org, key, range: "bytes=95-5000" });
    expect(clamped.headers.get("content-range")).toBe("bytes 95-99/100");
  });

  it("an invalid or unsatisfiable range returns 416", async () => {
    const org = await orgOf("RangeRuim");
    const { key } = await stored(org);
    for (const range of ["bytes=200-", "bytes=50-10", "bytes=abc", "bytes=-0", "items=0-1", "bytes=0-1,5-6"]) {
      const res = await serveFile(storage, { organizationId: org, key, range });
      expect(res.status, range).toBe(416);
      expect(res.headers.get("content-range"), range).toBe("bytes */100");
    }
  });

  it("serving a missing file returns the neutral 404", async () => {
    const org = await orgOf("Faltando");
    const res = await serveFile(storage, { organizationId: org, key: "00000000-0000-0000-0000-000000000000.jpg", range: null });
    const neutral = neutralNotFound();
    expect(res.status).toBe(404);
    expect([...res.headers]).toEqual([...neutral.headers]);
    expect(await res.text()).toBe(await neutral.text());
  });
});

describe("attachMedia", () => {
  async function post(org: string, format: "feed" | "carrossel" | "reels" | "stories") {
    const [p] = await db.insert(schema.contentPost).values({ organizationId: org, format }).returning();
    return p;
  }
  const up = (data: Uint8Array) => ({ body: streamOf(data), contentLength: data.length });
  const mediaOf = (postId: string) => db.select().from(schema.contentMedia).where(eq(schema.contentMedia.postId, postId)).orderBy(schema.contentMedia.position);

  it("a feed post takes exactly one image", async () => {
    const org = await orgOf("Feed");
    const p = await post(org, "feed");
    await attachMedia(db, storage, org, p.id, up(JPG()));
    await expect(attachMedia(db, storage, org, p.id, up(PNG()))).rejects.toBeInstanceOf(FileError);
    await expect(attachMedia(db, storage, org, p.id, up(MP4()))).rejects.toBeInstanceOf(FileError);
    expect(await mediaOf(p.id)).toHaveLength(1);
    expect((await filesIn(org)).length).toBe(1); // os arquivos recusados não ficam no disco
  });

  it("a carousel keeps the order, refuses videos and the 11th image", async () => {
    const org = await orgOf("Carrossel");
    const p = await post(org, "carrossel");
    for (let i = 0; i < 10; i++) await attachMedia(db, storage, org, p.id, up(i % 2 ? PNG() : JPG()));
    expect((await mediaOf(p.id)).map((m) => m.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    await expect(attachMedia(db, storage, org, p.id, up(JPG()))).rejects.toThrow(/10 imagens/);
    const q = await post(org, "carrossel");
    await expect(attachMedia(db, storage, org, q.id, up(MP4()))).rejects.toBeInstanceOf(FileError);
  });

  it("reels accepts one video plus one cover and refuses a second video or cover", async () => {
    const org = await orgOf("Reels");
    const p = await post(org, "reels");
    await expect(attachMedia(db, storage, org, p.id, { ...up(JPG()), isCover: false })).rejects.toBeInstanceOf(FileError); // Reels precisa do vídeo
    await attachMedia(db, storage, org, p.id, up(MP4()));
    await expect(attachMedia(db, storage, org, p.id, up(MP4()))).rejects.toBeInstanceOf(FileError);
    const cover = await attachMedia(db, storage, org, p.id, { ...up(JPG()), isCover: true });
    expect(cover.isCover).toBe(true);
    await expect(attachMedia(db, storage, org, p.id, { ...up(PNG()), isCover: true })).rejects.toBeInstanceOf(FileError);
    expect((await mediaOf(p.id)).map((m) => [m.kind, m.isCover])).toEqual([["video", false], ["image", true]]);
  });

  it("refuses stories, a cover outside reels, and posts of another organization", async () => {
    const org = await orgOf("Regras");
    const other = await orgOf("RegrasOutra");
    const stories = await post(org, "stories");
    await expect(attachMedia(db, storage, org, stories.id, up(JPG()))).rejects.toBeInstanceOf(FileError);
    const feed = await post(org, "feed");
    await expect(attachMedia(db, storage, org, feed.id, { ...up(JPG()), isCover: true })).rejects.toBeInstanceOf(FileError);
    await expect(attachMedia(db, storage, other, feed.id, up(JPG()))).rejects.toThrow();
    expect(await filesIn(other)).toEqual([]);
  });

  it("the avatar accepts only images and replaces the previous file on disk", async () => {
    const org = await orgOf("Avatar");
    await expect(setAvatar(db, storage, org, up(MP4()))).rejects.toBeInstanceOf(FileError);
    const first = await setAvatar(db, storage, org, up(JPG()));
    const second = await setAvatar(db, storage, org, up(PNG()));
    expect(second.key).not.toBe(first.key);
    expect(await filesIn(org)).toEqual([second.key]);
    const [profile] = await db.select().from(schema.contentProfile).where(eq(schema.contentProfile.organizationId, org));
    expect(profile.avatarFileKey).toBe(second.key);
  });

  it("findFileOwner finds the organization of a media file or an avatar, and null otherwise", async () => {
    const org = await orgOf("Dono");
    const p = await post(org, "feed");
    const media = await attachMedia(db, storage, org, p.id, up(JPG()));
    const avatar = await setAvatar(db, storage, org, up(PNG()));
    expect(await findFileOwner(db, media.fileKey)).toBe(org);
    expect(await findFileOwner(db, avatar.key)).toBe(org);
    expect(await findFileOwner(db, "00000000-0000-0000-0000-000000000000.jpg")).toBeNull();
  });
});
