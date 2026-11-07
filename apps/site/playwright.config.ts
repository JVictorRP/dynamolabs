import { defineConfig, devices } from "@playwright/test";

// Chromium sem GPU real: swiftshader permite WebGL nos testes.
const launchOptions = { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] };

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  use: { baseURL: "http://localhost:4173" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, launchOptions } },
    { name: "mobile", use: { ...devices["Pixel 7"], launchOptions } },
  ],
  // Rotas de laboratório (/lab/*) só renderizam com NEXT_PUBLIC_E2E=1.
  webServer: {
    command: "NEXT_PUBLIC_E2E=1 NEXT_PUBLIC_LEAD_ENDPOINT=https://app.dynamo.test/api/public/lead NEXT_PUBLIC_WHATSAPP_URL=https://wa.me/5500000000000 pnpm build && pnpm exec serve out -l 4173 --no-clipboard -c ../serve.json",
    url: "http://localhost:4173",
    reuseExistingServer: true,
    timeout: 240_000,
  },
});
