// Verificação ponta a ponta do conteúdo e da prévia (CRM em desenvolvimento + Postgres local).
// Uso: STAFF_PASSWORD=... node e2e/conteudo.mjs <pasta-das-capturas>
// Variáveis: BASE (padrão http://localhost:3200), STAFF_EMAIL (padrão dono@demo.test), STAFF_PASSWORD.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(join(here, "../../site/node_modules/@playwright/test/index.mjs"));
const BASE = process.env.BASE ?? "http://localhost:3200";
const STAFF_EMAIL = process.env.STAFF_EMAIL ?? "dono@demo.test";
const STAFF_PASSWORD = process.env.STAFF_PASSWORD;
const OUT = process.argv[2] ?? ".";
const FX = join(here, "../tests/fixtures");
if (!STAFF_PASSWORD) throw new Error("Defina STAFF_PASSWORD.");

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`);
};
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
const page = await ctx.newPage();
page.setDefaultTimeout(45000);
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(String(e)));


async function login(p, email, password) {
  await p.context().clearCookies();
  await p.goto(BASE + "/login", { timeout: 90000 });
  await p.fill('input[name="email"]', email);
  await p.fill('input[name="password"]', password);
  await p.click('button[type="submit"]');
  try {
    await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
    return true;
  } catch {
    return false;
  }
}

/* ───── Equipe: cria o cliente e monta o conteúdo ───── */
check("equipe entra", await login(page, STAFF_EMAIL, STAFF_PASSWORD));
const stamp = Date.now().toString(36);
const empresa = `Conteudo ${stamp}`;
await page.goto(BASE + "/clientes", { timeout: 90000 });
await page.fill('input[name="empresa"]', empresa);
await page.fill('input[name="nome"]', "Cliente Teste");
await page.fill('input[name="email"]', `cliente-${stamp}@teste.dev`);
await page.click('button:has-text("Criar cliente")');
await page.getByText("a senha aparece só agora").waitFor();
await page.click(`a:has-text("${empresa}")`);
await page.getByRole("link", { name: "Abrir conteúdo" }).click();
await page.waitForURL(/\/clientes\/.+\/conteudo/);
const orgId = page.url().match(/clientes\/([^/]+)\/conteudo/)[1];
check("página de conteúdo abre", (await page.locator("h1").innerText()).toLowerCase().includes("conteúdo"));

const linkText = await page.locator("p.font-mono").first().innerText();
const token = linkText.match(/\/p\/([A-Za-z0-9_-]{24})$/)?.[1];
check("link fixo do cliente com código de 24 caracteres", Boolean(token), linkText);
await page.click('button:has-text("Copiar mensagem")');
const clip = await page.evaluate(() => navigator.clipboard.readText());
check("mensagem copiada tem o link e o texto combinado", clip.includes(linkText) && clip.startsWith("Olá! Seus próximos posts estão prontos para você ver e aprovar:"));

// Perfil
await page.getByPlaceholder("@lojadoze").fill("@LojaDoZe");
await page.locator('label:has-text("Nome do perfil") input').fill("Loja do Zé");
await page.locator('label:has-text("Bio") textarea').fill("Pães artesanais\nSeg a sáb, 7h às 19h");
await page.locator('label:has-text("Link do perfil") input').fill("https://lojadoze.com.br");
await page.click('button:has-text("Salvar perfil")');
await page.getByText("Salvo.").first().waitFor();
await page.locator('input[type="file"]').first().setInputFiles(join(FX, "mini1.jpg"));
await page.waitForFunction(() => document.querySelector("aside img[src*='/api/conteudo/arquivos/']") !== null);
check("perfil salvo e foto enviada aparecem na prévia", (await page.locator("aside h2").first().innerText()) === "lojadoze");

async function newPost(format, title) {
  await page.locator('form:has(button:has-text("Criar post")) select').selectOption(format);
  await page.locator('form:has(button:has-text("Criar post")) input[maxlength="120"]').fill(title);
  const before = page.url();
  await page.click('button:has-text("Criar post")');
  await page.waitForURL((u) => u.href !== before && /editar=/.test(u.search));
  const rotulo = { feed: "Post único", carrossel: "Carrossel", reels: "Reels" }[format];
  await page.waitForFunction((r) => document.querySelector("#editor")?.textContent?.includes(`Editando · ${r}`), rotulo);
}
const editor = () => page.locator("#editor");
const upload = async (files) => {
  await editor().locator('input[type="file"]').first().setInputFiles(files);
};

// Post único
await newPost("feed", "Post único");
await editor().locator("textarea").fill("Pão de fermentação natural, feito todos os dias com ingredientes selecionados. Venha provar o sabor de verdade e traga a família inteira para conhecer a nossa padaria!");
await editor().getByRole("button", { name: "Salvar", exact: true }).click();
await editor().getByText("Salvo.").waitFor();
await upload(join(FX, "mini1.jpg"));
await editor().locator('img[src*="/api/conteudo/arquivos/"]').first().waitFor();
check("post único recebe a imagem", (await editor().locator("li img").count()) === 1);
await editor().getByRole("button", { name: "Enviar para aprovação" }).click();
await page.waitForFunction(() => document.querySelector("#editor")?.textContent?.includes("Para aprovar"));

// Carrossel com 3 imagens de uma vez
await newPost("carrossel", "Carrossel de pães");
await editor().locator("textarea").fill("Três jeitos de comer o nosso pão.");
await editor().getByRole("button", { name: "Salvar", exact: true }).click();
await editor().getByText("Salvo.").waitFor();
await upload([join(FX, "mini1.jpg"), join(FX, "mini2.png"), join(FX, "mini3.webp")]);
await page.waitForFunction(() => document.querySelectorAll("#editor li img").length === 3);
check("carrossel recebe 3 imagens em ordem", (await editor().locator("ul.grid li").allInnerTexts()).map((t) => t.split("\n")[0]).join("|") === "Imagem 1|Imagem 2|Imagem 3");
await editor().getByRole("button", { name: "Mover para antes" }).nth(2).click();
await page.waitForFunction(() => document.querySelectorAll("#editor ul.grid li")[1]?.textContent?.includes("Imagem 2") && document.querySelectorAll("#editor ul.grid li").length === 3);
check("ordem do carrossel muda com a seta", true);
await editor().getByRole("button", { name: "Enviar para aprovação" }).click();
await page.waitForFunction(() => document.querySelector("#editor")?.textContent?.includes("Para aprovar"));

// Reels com vídeo e capa
await newPost("reels", "Reels da fornada");
await editor().locator("textarea").fill("Fornada saindo agora!");
await editor().getByRole("button", { name: "Salvar", exact: true }).click();
await editor().getByText("Salvo.").waitFor();
await editor().locator('input[type="file"]').first().setInputFiles(join(FX, "mini.mp4"));
await editor().locator("video").waitFor();
await editor().locator('input[type="file"]').last().setInputFiles(join(FX, "capa.jpg"));
await page.waitForFunction(() => document.querySelectorAll("#editor ul.grid li").length === 2);
const partes = (await editor().locator("ul.grid li").allInnerTexts()).map((t) => t.split("\n")[0]).join("|");
check("reels recebe vídeo e capa", partes === "Vídeo|Capa", partes);
await editor().getByRole("button", { name: "Enviar para aprovação" }).click();
await page.waitForFunction(() => document.querySelector("#editor")?.textContent?.includes("Para aprovar"));

// Regras de envio
await newPost("feed", "Post de teste de regra");
await editor().locator('input[type="file"]').first().setInputFiles({ name: "falso.jpg", mimeType: "image/jpeg", buffer: Buffer.from("isto é só texto, não é imagem".repeat(5)) });
await editor().getByText("Formato não aceito").waitFor();
check("arquivo que não é imagem é recusado com mensagem clara", true);
page.once("dialog", (d) => d.accept());
await editor().getByRole("button", { name: "Apagar de vez" }).click();
await page.waitForURL((u) => !u.search.includes("editar="));
check("apagar de vez remove o post de teste", (await page.getByText("Post de teste de regra").count()) === 0);

/* ───── Prévia da equipe ───── */
await page.goto(`${BASE}/clientes/${orgId}/conteudo`);
const cells = page.locator("aside ul button");
check("a grade da prévia mostra os 3 posts enviados", (await cells.count()) >= 3, `${await cells.count()} células`);
await page.screenshot({ path: join(OUT, "equipe-conteudo.png"), fullPage: true });
await browser.close();
console.log(JSON.stringify({ orgId, token, empresa, stamp }));
console.log(consoleErrors.length ? "Erros no console: " + consoleErrors.join(" | ") : "Sem erros no console.");
process.exit(results.every(Boolean) ? 0 : 1);
