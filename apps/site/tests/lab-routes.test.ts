import { afterEach, describe, expect, it, vi } from "vitest";

async function loadConfig(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return (await import("../next.config")).default;
}

afterEach(() => vi.unstubAllEnvs());

describe("lab routes (/lab/*)", () => {
  it("are not routes at all in a production build", async () => {
    const config = await loadConfig({ NODE_ENV: "production", NEXT_PUBLIC_E2E: "" });
    expect(config.pageExtensions).not.toContain("lab.tsx");
  });

  it("exist in the e2e build", async () => {
    const config = await loadConfig({ NODE_ENV: "production", NEXT_PUBLIC_E2E: "1" });
    expect(config.pageExtensions).toContain("lab.tsx");
  });

  it("exist in development", async () => {
    const config = await loadConfig({ NODE_ENV: "development", NEXT_PUBLIC_E2E: "" });
    expect(config.pageExtensions).toContain("lab.tsx");
  });

  it("keep the normal page extensions in every case", async () => {
    const config = await loadConfig({ NODE_ENV: "production", NEXT_PUBLIC_E2E: "" });
    expect(config.pageExtensions).toEqual(expect.arrayContaining(["tsx", "ts"]));
  });
});
