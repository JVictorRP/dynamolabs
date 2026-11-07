import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const BASE = "https://dynamo.business";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/privacidade", "/termos"].map((path) => ({ url: `${BASE}${path}`, changeFrequency: "monthly", priority: path === "" ? 1 : 0.3 }));
}
