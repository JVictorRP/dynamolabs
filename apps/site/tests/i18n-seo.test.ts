import { describe, expect, it } from "vitest";
import { homeMetadata, legalMetadata, organizationJsonLd, sitemapEntries } from "../src/lib/i18n/seo";

const ALL = ["pt", "en", "es"] as const;

describe("homeMetadata", () => {
  it("uses the title and description of the language, the Open Graph locale and the canonical path", () => {
    const m = homeMetadata("en", ALL);
    expect(m.title).toEqual({ default: "Dynamo | Digital marketing with AI and automation", template: "%s" });
    expect(m.description).toMatch(/Digital marketing agency/);
    expect(m.openGraph).toMatchObject({ locale: "en_US", alternateLocale: ["pt_BR", "es_ES"], url: "/en", type: "website" });
    expect(m.alternates?.canonical).toBe("/en");
  });

  it("lists every published language as hreflang, with x-default pointing at the Portuguese home", () => {
    const m = homeMetadata("es", ALL);
    expect(m.alternates?.languages).toEqual({ "pt-BR": "/", en: "/en", es: "/es", "x-default": "/" });
  });

  it("leaves unpublished languages out of hreflang and alternateLocale", () => {
    const m = homeMetadata("pt", ["pt", "es"]);
    expect(m.alternates?.languages).toEqual({ "pt-BR": "/", es: "/es", "x-default": "/" });
    expect(m.openGraph).toMatchObject({ locale: "pt_BR", alternateLocale: ["es_ES"] });
  });

  it("Portuguese keeps its approved title and the metadataBase of the site", () => {
    const m = homeMetadata("pt", ["pt"]);
    expect((m.title as { default: string }).default).toBe("Dynamo | Marketing digital com IA e automação");
    expect(String(m.metadataBase)).toBe("https://dynamo.business/");
    expect(m.alternates?.languages).toEqual({ "pt-BR": "/", "x-default": "/" });
  });
});

describe("legalMetadata", () => {
  it("uses the legal title of the language, the canonical of that page and the equivalents in the other languages", () => {
    const m = legalMetadata("es", "terms", ALL);
    expect(m.title).toBe("Términos de uso · Dynamo");
    expect(m.alternates?.canonical).toBe("/es/terminos");
    expect(m.alternates?.languages).toEqual({ "pt-BR": "/termos", en: "/en/terms", es: "/es/terminos", "x-default": "/termos" });
    expect(m.openGraph).toMatchObject({ locale: "es_ES", url: "/es/terminos" });
  });
});

describe("sitemapEntries", () => {
  it("lists the three pages of each published language with their alternates", () => {
    const entries = sitemapEntries(["pt", "en"]);
    expect(entries.map((e) => e.url)).toEqual([
      "https://dynamo.business",
      "https://dynamo.business/privacidade",
      "https://dynamo.business/termos",
      "https://dynamo.business/en",
      "https://dynamo.business/en/privacy",
      "https://dynamo.business/en/terms",
    ]);
    expect(entries[3].alternates?.languages).toEqual({ "pt-BR": "https://dynamo.business", en: "https://dynamo.business/en", "x-default": "https://dynamo.business" });
    expect(entries[2].alternates?.languages).toEqual({ "pt-BR": "https://dynamo.business/termos", en: "https://dynamo.business/en/terms", "x-default": "https://dynamo.business/termos" });
  });

  it("with only Portuguese there is no alternate besides itself", () => {
    expect(sitemapEntries(["pt"]).map((e) => e.url)).toEqual(["https://dynamo.business", "https://dynamo.business/privacidade", "https://dynamo.business/termos"]);
  });
});

describe("organizationJsonLd", () => {
  it("describes the organization in the language of the page", () => {
    const data = organizationJsonLd("es") as { "@type": string; description: string; url: string; name: string };
    expect(data["@type"]).toBe("Organization");
    expect(data.name).toBe("Dynamo");
    expect(data.url).toBe("https://dynamo.business");
    expect(data.description).toMatch(/Agencia de marketing digital/);
  });
});
