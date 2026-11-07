import { describe, expect, it } from "vitest";
import { headerState } from "../src/lib/choreo/header-state";

describe("headerState in the video stage (hero + section 2)", () => {
  it("starts transparent with the light logo over the opening shot", () => {
    expect(headerState({ section: "hero-s2", p: 0.1 })).toMatchObject({ variant: "transparent", logo: "claro", indicator: 0 });
  });

  it("turns into frosted dark glass while the camera descends (25–45%)", () => {
    expect(headerState({ section: "hero-s2", p: 0.35 })).toMatchObject({ variant: "glass", logo: "claro" });
  });

  it("is compact in section 2 and shows how far the video went (45–80%)", () => {
    const s = headerState({ section: "hero-s2", p: 0.6 });
    expect(s.variant).toBe("compact");
    expect(s.indicator).toBeCloseTo(0.4286, 3);
    expect(headerState({ section: "hero-s2", p: 0.95 }).indicator).toBe(1);
  });
});

describe("headerState across the light and dark sections", () => {
  it("is light with the graphite logo on the white chatbot section", () => {
    expect(headerState({ section: "chat", p: 0.5 })).toMatchObject({ variant: "light", logo: "grafite", indicator: 0 });
  });

  it("is dark glass with the light logo over the second video and the footer", () => {
    expect(headerState({ section: "video2", p: 0.2 })).toMatchObject({ variant: "dark-glass", logo: "claro" });
    expect(headerState({ section: "footer", p: 0 })).toMatchObject({ variant: "dark-glass", logo: "claro" });
  });
});
