import { afterEach, describe, expect, it, vi } from "vitest";
import { createTitle3D } from "../src/lib/title3d/title3d";

afterEach(() => vi.unstubAllGlobals());

describe("createTitle3D font loading (item: one failed download poisoned the cache and every title stayed missing)", () => {
  it("does not cache a failed download: the next call fetches the font again", async () => {
    const fetchMock = vi.fn(async () => new Response("nope", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const opts = { text: "SUA MARCA", fontUrl: "/fonts/missing.ttf", color: 0xffffff };
    await expect(createTitle3D(opts)).rejects.toThrow();
    await expect(createTitle3D(opts)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
