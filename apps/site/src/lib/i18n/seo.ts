import type { Metadata, MetadataRoute } from "next";
import { getCopy } from "@/content/copy/index";
import { getLegal } from "@/content/legal/index";
import { SITE } from "@/content/site";
import { DEFAULT_LANG, HTML_LANG, OG_LOCALE, pathFor, type Lang, type PageKey } from "./config";

const BASE = "https://dynamo.business";

/** hreflang de uma página: cada idioma no ar aponta para a mesma página no seu idioma; x-default é o português. */
function alternatesFor(page: PageKey, langs: readonly Lang[]): Record<string, string> {
  return { ...Object.fromEntries(langs.map((l) => [HTML_LANG[l], pathFor(l, page)])), "x-default": pathFor(DEFAULT_LANG, page) };
}

function shared(lang: Lang, page: PageKey, langs: readonly Lang[], title: string, description: string): Metadata {
  const others = langs.filter((l) => l !== lang);
  const images = [{ url: "/og.png", width: 1200, height: 630, alt: "Dynamo" }];
  return {
    metadataBase: new URL(BASE),
    description,
    openGraph: { type: "website", siteName: "Dynamo", locale: OG_LOCALE[lang], alternateLocale: others.map((l) => OG_LOCALE[l]), url: pathFor(lang, page), title, description, images },
    twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
    alternates: { canonical: pathFor(lang, page), languages: alternatesFor(page, langs) },
  };
}

/** Metadados da página inicial de um idioma (título, descrição, Open Graph, canonical e hreflang). */
export function homeMetadata(lang: Lang, langs: readonly Lang[]): Metadata {
  const { title, description } = getCopy(lang).meta;
  return { ...shared(lang, "home", langs, title, description), title: { default: title, template: "%s" } };
}

/** Metadados de uma página legal: o título do idioma e as páginas equivalentes nos outros idiomas. */
export function legalMetadata(lang: Lang, page: "privacy" | "terms", langs: readonly Lang[]): Metadata {
  const title = getLegal(lang)[page].metaTitle;
  return { ...shared(lang, page, langs, title, getCopy(lang).meta.description), title };
}

const urlOf = (lang: Lang, page: PageKey) => `${BASE}${pathFor(lang, page) === "/" ? "" : pathFor(lang, page)}`;

/** As três páginas de cada idioma no ar, cada uma com as alternativas por idioma (`xhtml:link` no sitemap). */
export function sitemapEntries(langs: readonly Lang[]): MetadataRoute.Sitemap {
  return langs.flatMap((lang) =>
    (["home", "privacy", "terms"] as const).map((page) => ({
      url: urlOf(lang, page),
      changeFrequency: "monthly" as const,
      priority: page === "home" ? 1 : 0.3,
      alternates: { languages: { ...Object.fromEntries(langs.map((l) => [HTML_LANG[l], urlOf(l, page)])), "x-default": urlOf(DEFAULT_LANG, page) } },
    })),
  );
}

/** Dados estruturados da organização, com a descrição do idioma da página. */
export function organizationJsonLd(lang: Lang) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Dynamo",
    url: BASE,
    logo: `${BASE}/brand/dynamo-lockup-grafite.png`,
    description: getCopy(lang).meta.description,
    ...(SITE.instagram || SITE.linkedin ? { sameAs: [SITE.instagram, SITE.linkedin].filter(Boolean) } : {}),
  };
}
