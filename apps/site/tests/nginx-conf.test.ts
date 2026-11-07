import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const conf = readFileSync(new URL("../nginx.conf", import.meta.url), "utf8");
const block = (location: string) => {
  const start = conf.indexOf(`location ${location}`);
  expect(start, `location ${location} must exist`).toBeGreaterThanOrEqual(0);
  return conf.slice(start, conf.indexOf("}", start));
};

// Lint da configuração (não roda o nginx): as regras de cache e compressão que o orçamento de desempenho exige.
describe("nginx.conf", () => {
  it("serves the static export from the html root with gzip on for text assets", () => {
    expect(conf).toMatch(/root\s+\/usr\/share\/nginx\/html;/);
    expect(conf).toMatch(/gzip\s+on;/);
    expect(conf).toMatch(/gzip_types[^;]*application\/javascript/);
    expect(conf).toMatch(/gzip_types[^;]*text\/css/);
  });

  it("caches the frames and the hashed build assets for a year, immutable", () => {
    for (const location of ["/frames/", "/_next/static/"]) {
      expect(block(location)).toMatch(/Cache-Control\s+"public, max-age=31536000, immutable"/);
    }
  });

  it("revalidates the frames manifest every time: it has no hash in its name, while the frames carry ?v=<version>", () => {
    const start = conf.search(/location\s+~\*\s+\^\/frames\/[^\n]*manifest/);
    expect(start, "a dedicated location for manifest.json must exist").toBeGreaterThanOrEqual(0);
    expect(conf.slice(start, conf.indexOf("}", start))).toMatch(/Cache-Control\s+"no-cache"/);
  });

  it("never caches the HTML (so a new deploy shows up at once)", () => {
    expect(block("/ ")).toMatch(/Cache-Control\s+"no-cache"/);
  });

  it("resolves clean URLs (/privacidade → privacidade.html) and has a 404 page", () => {
    expect(conf).toMatch(/try_files\s+\$uri\s+\$uri\.html\s+\$uri\/\s+=404;/);
    expect(conf).toMatch(/error_page\s+404\s+\/404\.html;/);
  });

  it("sends basic hardening headers", () => {
    expect(conf).toMatch(/X-Content-Type-Options\s+"nosniff"/);
    expect(conf).toMatch(/Referrer-Policy/);
  });
});
