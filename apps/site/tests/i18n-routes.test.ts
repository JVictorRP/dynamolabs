import { afterEach, describe, expect, it, vi } from "vitest";

async function loadConfig(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return (await import("../next.config")).default;
}

afterEach(() => vi.unstubAllEnvs());

// As páginas de [lang] usam a extensão "i18n.tsx", que só é página quando há idioma extra no ar (rotas dinâmicas com lista
// vazia nem compilam no export). Com en e es aprovados (status final), a build de produção gera /en e /es. A regra de
// "sem idioma aprovado, sem rota" é testada com dados sintéticos em i18n-config.test.ts (hasExtraLanguages).
describe("language routes ([lang]) in next.config", () => {
  it("are routes in a production build now that en and es are approved (final)", async () => {
    const config = await loadConfig({ NODE_ENV: "production", NEXT_PUBLIC_E2E: "" });
    expect(config.pageExtensions).toContain("i18n.tsx");
    expect(config.pageExtensions).not.toContain("lab.tsx"); // as páginas de laboratório continuam fora da produção
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
