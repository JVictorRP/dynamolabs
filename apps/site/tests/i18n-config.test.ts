import { describe, expect, it } from "vitest";
import { DEFAULT_LANG, HTML_LANG, LANGS, OG_LOCALE, hasExtraLanguages, isLang, legalSlugs, pageFromSlug, pathFor, publishedLangs, showAllLanguages, type Lang, type Status } from "../src/lib/i18n/config";

const statuses = (over: Partial<Record<Lang, { copy: Status; legal: Status }>> = {}): Record<Lang, { copy: Status; legal: Status }> => ({
  pt: { copy: "final", legal: "final" },
  en: { copy: "final", legal: "final" },
  es: { copy: "final", legal: "final" },
  ...over,
});

describe("i18n config", () => {
  it("lists pt, en and es, with pt as the default", () => {
    expect([...LANGS]).toEqual(["pt", "en", "es"]);
    expect(DEFAULT_LANG).toBe("pt");
  });

  it("maps every language to its html lang and Open Graph locale", () => {
    expect(HTML_LANG).toEqual({ pt: "pt-BR", en: "en", es: "es" });
    expect(OG_LOCALE).toEqual({ pt: "pt_BR", en: "en_US", es: "es_ES" });
  });

  it("builds the path of each page in each language", () => {
    expect([pathFor("pt", "home"), pathFor("pt", "privacy"), pathFor("pt", "terms")]).toEqual(["/", "/privacidade", "/termos"]);
    expect([pathFor("en", "home"), pathFor("en", "privacy"), pathFor("en", "terms")]).toEqual(["/en", "/en/privacy", "/en/terms"]);
    expect([pathFor("es", "home"), pathFor("es", "privacy"), pathFor("es", "terms")]).toEqual(["/es", "/es/privacidad", "/es/terminos"]);
  });

  it("recognizes only the supported languages", () => {
    expect(isLang("en")).toBe(true);
    expect(isLang("pt")).toBe(true);
    expect(isLang("fr")).toBe(false);
    expect(isLang("")).toBe(false);
  });
});

describe("publishedLangs", () => {
  it("keeps only languages whose copy and legal texts are both final", () => {
    expect(publishedLangs(statuses({ en: { copy: "provisional", legal: "final" } }), false)).toEqual(["pt", "es"]);
    expect(publishedLangs(statuses({ es: { copy: "final", legal: "provisional" } }), false)).toEqual(["pt", "en"]);
  });

  it("returns every language when showAll is on", () => {
    expect(publishedLangs(statuses({ en: { copy: "provisional", legal: "provisional" }, es: { copy: "provisional", legal: "provisional" } }), true)).toEqual(["pt", "en", "es"]);
  });

  it("always includes pt, even if its statuses were provisional", () => {
    expect(publishedLangs(statuses({ pt: { copy: "provisional", legal: "provisional" } }), false)).toContain("pt");
  });
});

describe("showAllLanguages", () => {
  it("is off in production", () => {
    expect(showAllLanguages({ NODE_ENV: "production" })).toBe(false);
  });
  it("is on for the e2e build", () => {
    expect(showAllLanguages({ NODE_ENV: "production", NEXT_PUBLIC_E2E: "1" })).toBe(true);
  });
  it("is on in development", () => {
    expect(showAllLanguages({ NODE_ENV: "development" })).toBe(true);
  });
});

describe("legal slugs", () => {
  it("lists the legal slugs of the non-default languages", () => {
    expect(legalSlugs("en")).toEqual([{ slug: "privacy", page: "privacy" }, { slug: "terms", page: "terms" }]);
    expect(legalSlugs("es")).toEqual([{ slug: "privacidad", page: "privacy" }, { slug: "terminos", page: "terms" }]);
  });
  it("resolves a slug back to its page, or null when it does not belong to the language", () => {
    expect(pageFromSlug("es", "terminos")).toBe("terms");
    expect(pageFromSlug("en", "privacy")).toBe("privacy");
    expect(pageFromSlug("en", "privacidad")).toBeNull();
    expect(pageFromSlug("es", "x")).toBeNull();
  });
});

describe("hasExtraLanguages", () => {
  it("is false when only Portuguese is published (the /en and /es routes must not exist)", () => {
    expect(hasExtraLanguages(statuses({ en: { copy: "provisional", legal: "provisional" }, es: { copy: "provisional", legal: "final" } }), false)).toBe(false);
  });
  it("is true when at least one extra language is approved, or when showing all", () => {
    expect(hasExtraLanguages(statuses({ en: { copy: "provisional", legal: "provisional" } }), false)).toBe(true);
    expect(hasExtraLanguages(statuses({ en: { copy: "provisional", legal: "provisional" }, es: { copy: "provisional", legal: "provisional" } }), true)).toBe(true);
  });
});
