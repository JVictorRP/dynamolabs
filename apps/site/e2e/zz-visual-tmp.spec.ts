import { test } from "@playwright/test";

// Utilitário de revisão visual (não é um teste de regressão): com E2E_SHOTS=1 grava capturas em
// test-results/shots/ (ignorado pelo git) para o laço "capturar → ajustar" das tasks de design.
// Sem a variável, o teste é pulado.
test("save screenshots", async ({ page }, info) => {
  test.skip(!process.env.E2E_SHOTS, "defina E2E_SHOTS=1 para gravar capturas");
  await page.goto("/lab/stage");
  await page.waitForFunction(() => Boolean(window.__lab));
  for (const p of [0, 0.5, 1]) {
    await page.evaluate(async (v) => {
      window.__lab!.setProgress(v);
      await window.__lab!.settled();
    }, p);
    await page.screenshot({ path: `test-results/shots/stage-${info.project.name}-${p}.png` });
  }
});
