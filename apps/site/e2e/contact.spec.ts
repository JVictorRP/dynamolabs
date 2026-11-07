import { expect, test, type Page } from "@playwright/test";

const ENDPOINT = "https://app.dynamo.test/api/public/lead";
const CORS = { "access-control-allow-origin": "http://localhost:4173", "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST, OPTIONS" };

/** Intercepta o endpoint do CRM (o site fala com outra origem) e registra os corpos recebidos. */
async function mockEndpoint(page: Page, status: number, delayMs = 0) {
  const bodies: unknown[] = [];
  await page.route(ENDPOINT, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    bodies.push(request.postDataJSON());
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    await route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: "{}" });
  });
  return bodies;
}

async function openForm(page: Page) {
  await page.goto("/");
  const form = page.locator("footer form");
  await form.scrollIntoViewIfNeeded();
  return form;
}

const fill = async (form: ReturnType<Page["locator"]>, name = "Maria Souza", email = "maria@exemplo.com.br") => {
  await form.getByLabel("Nome").fill(name);
  await form.getByLabel("E-mail").fill(email);
};

test("sends the lead to the CRM endpoint and confirms", async ({ page }) => {
  const bodies = await mockEndpoint(page, 201);
  const form = await openForm(page);
  await fill(form);
  await form.getByLabel(/Como podemos ajudar/).fill("Quero um orçamento 🌿");
  await form.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("Recebemos sua mensagem")).toBeVisible();
  expect(bodies).toEqual([{ name: "Maria Souza", email: "maria@exemplo.com.br", message: "Quero um orçamento 🌿", website: "" }]);
});

test("a real double click creates a single request", async ({ page }) => {
  const bodies = await mockEndpoint(page, 201, 400);
  const form = await openForm(page);
  await fill(form);
  await form.getByRole("button", { name: "Enviar" }).dblclick();
  await expect(page.getByText("Recebemos sua mensagem")).toBeVisible();
  expect(bodies).toHaveLength(1);
});

test("an invalid e-mail is explained and nothing is sent", async ({ page }) => {
  const bodies = await mockEndpoint(page, 201);
  const form = await openForm(page);
  await fill(form, "Maria", "isso-nao-e-email");
  await form.getByRole("button", { name: "Enviar" }).click();
  await expect(form.getByRole("alert")).toContainText("Confira o e-mail");
  expect(bodies).toHaveLength(0);
});

test("when the CRM is down: clear message, WhatsApp link, and the form keeps what was typed", async ({ page }) => {
  await mockEndpoint(page, 500);
  const form = await openForm(page);
  await fill(form);
  await form.getByRole("button", { name: "Enviar" }).click();
  const alert = form.getByRole("alert");
  await expect(alert).toContainText("Não foi possível enviar");
  await expect(alert.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/5500000000000");
  await expect(form.getByLabel("E-mail")).toHaveValue("maria@exemplo.com.br");
  await expect(form.getByRole("button", { name: "Enviar" })).toBeEnabled();
});

test("the honeypot field is unreachable for people: not focusable and hidden from assistive tech", async ({ page }) => {
  const form = await openForm(page);
  const trap = form.locator('input[name="website"]');
  await expect(trap).toHaveAttribute("tabindex", "-1");
  expect(await trap.evaluate((el) => el.closest('[aria-hidden="true"]') !== null)).toBe(true);
  await form.getByLabel("Nome").focus();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.name)).not.toBe("website");
  }
});
