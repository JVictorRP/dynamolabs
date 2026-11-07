import { describe, expect, it } from "vitest";
import { HEADER_EDGE, siteSection } from "../src/lib/choreo/site-section";

// `chatEdge` / `video2Edge`: onde está o topo da seção que chega, em fração da altura da tela (1 = logo abaixo, 0 = encheu a tela).
const at = (s: { hero?: number; chat?: number; video2?: number; chatEdge?: number; video2Edge?: number }) =>
  siteSection({ hero: 0, chat: 0, video2: 0, chatEdge: 1, video2Edge: 1, ...s });

describe("siteSection (which section the menu is in, from the stages' progress and where the incoming section's top edge is)", () => {
  it("is the video stage while the next section is still below the menu", () => {
    expect(at({ hero: 0.3 })).toEqual({ section: "hero-s2", p: 0.3 });
    expect(at({ hero: 1, chatEdge: 0.5 })).toEqual({ section: "hero-s2", p: 1 });
  });

  it("switches to the chat section the moment its top edge reaches the menu, not before", () => {
    expect(at({ hero: 1, chatEdge: HEADER_EDGE + 0.01 }).section).toBe("hero-s2");
    expect(at({ hero: 1, chatEdge: HEADER_EDGE }).section).toBe("chat");
    expect(at({ hero: 1, chat: 0.5, chatEdge: 0 })).toEqual({ section: "chat", p: 0.5 });
  });

  it("switches to the closing video when its top edge reaches the menu, and stays there for the footer", () => {
    expect(at({ chat: 1, chatEdge: 0, video2Edge: HEADER_EDGE + 0.01 }).section).toBe("chat");
    expect(at({ chat: 1, chatEdge: 0, video2Edge: HEADER_EDGE }).section).toBe("video2");
    expect(at({ chat: 1, chatEdge: 0, video2: 0.2, video2Edge: 0 })).toEqual({ section: "video2", p: 0.2 });
  });
});
