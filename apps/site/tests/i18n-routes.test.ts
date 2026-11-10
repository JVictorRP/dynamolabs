import { afterEach, describe, expect, it, vi } from "vitest";

async function loadConfig(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return (await import("../next.config")).default;
}

afterEach(() => vi.unstubAllEnvs());

// Enquanto en e es estão provisórios, uma build de produção não gera /en nem /es (rotas dinâmicas com lista vazia nem
// compilam no export). As páginas de [lang] usam a extensão "i18n.tsx", que só é página quando há idioma extra no ar.
describe("language routes ([lang]) in next.config", () => {
  it("are not routes in a production build while en and es are provisional", async () => {
    const config = await loadConfig({ NODE_ENV: "production", NEXT_PUBLIC_E2E: "" });
    expect(config.pageExtensions).not.toContain("i18n.tsx");
  });

  it("exist in the e2e build", async () => {
    const config = await loadConfig({ NODE_ENV: "production", NEXT_PUBLIC_E2E: "1" });
    expect(config.pageExtensions).toContain("i18n.tsx");
    expect(config.pageExtensions).toContain("lab.tsx");
  });

  it("exist in development", async () => {
    const config = await loadConfig({ NODE_ENV: "development", NEXT_PUBLIC_E2E: "" });
    expect(config.pageExtensions).toContain("i18n.tsx");
  });
});
