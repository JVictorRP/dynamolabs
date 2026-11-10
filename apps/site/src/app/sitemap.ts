import type { MetadataRoute } from "next";
import { activeLangs } from "@/content/status";
import { sitemapEntries } from "@/lib/i18n/seo";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries(activeLangs());
}
