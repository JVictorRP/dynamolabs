// Verificação ponta a ponta do conteúdo e da prévia (CRM em desenvolvimento + Postgres local).
// Uso: STAFF_PASSWORD=... node e2e/conteudo.mjs <pasta-das-capturas>
// Variáveis: BASE (padrão http://localhost:3200), STAFF_EMAIL (padrão dono@demo.test), STAFF_PASSWORD.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";

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
// Chrome de verdade quando houver (o Chromium do Playwright não toca H.264); senão, sem a checagem de reprodução.
let browser;
let canPlay = true;
try {
  browser = await chromium.launch({ channel: "chrome" });
} catch {
  browser = await chromium.launch();
  canPlay = false;
}
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
const clientPassword = (await page.locator("dd.font-mono.text-amber").first().innerText()).trim();
const clientEmail = `cliente-${stamp}@teste.dev`;
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
check("a grade da prévia da equipe mostra os 3 posts enviados", (await page.locator("aside ul button").count()) === 3);
const sql = (q) => execSync(`docker exec dyn-pg psql -U dynamo -Atc "${q}"`).toString().trim();

/* ───── Cliente: abre o link SEM login ───── */
const guest = await browser.newContext({ viewport: { width: 1280, height: 950 } });
await guest.grantPermissions(["clipboard-read"], { origin: BASE }).catch(() => {});
const link = await guest.newPage();
link.setDefaultTimeout(45000);
const rangeRequests = [];
link.on("request", (r) => {
  if (r.url().includes("/arquivo/") && r.url().endsWith(".mp4") && r.headers()["range"]) rangeRequests.push(r.headers()["range"]);
});
const linkErrors = [];
link.on("pageerror", (e) => linkErrors.push(String(e)));
await link.goto(`${BASE}/p/${token}`);
check("link abre sem login e mostra o perfil como h1", (await link.locator("h1").innerText()) === "lojadoze" && !link.url().includes("/login"));
check("o link não pede login nem mostra menu do painel", (await link.getByText("Meu painel").count()) === 0);
const cell = (re) => link.getByRole("button", { name: re });
check("a grade tem 3 posts, com Reels e carrossel identificados", (await link.locator("ul button").count()) === 3 && (await cell(/Abrir Reels: Reels da fornada/).count()) === 1 && (await cell(/Abrir carrossel: Carrossel de pães/).count()) === 1);
const robots = await link.locator('meta[name="robots"]').first().getAttribute("content");
check("a página pede noindex", /noindex/.test(robots ?? ""));
await link.screenshot({ path: join(OUT, "link-grade.png") });

// Teclado: Enter abre, Esc fecha e devolve o foco
await cell(/Abrir post: Post único/).focus();
await link.keyboard.press("Enter");
await link.getByRole("dialog").waitFor();
check("Enter abre a prévia do post em um diálogo", true);
// Post único: legenda cortada e "mais"
const dlg = link.getByRole("dialog");
const before = await dlg.locator("article p.whitespace-pre-line").first().innerText();
await dlg.getByRole("button", { name: "mais" }).click();
const after = await dlg.locator("article p.whitespace-pre-line").first().innerText();
check("a legenda aparece cortada e o 'mais' mostra o resto", before.includes("…") && after.length > before.length && after.includes("padaria!"));
await link.screenshot({ path: join(OUT, "link-post.png") });
await link.keyboard.press("Escape");
await dlg.waitFor({ state: "detached" });
check("Esc fecha e o foco volta para o post", await link.evaluate(() => document.activeElement?.getAttribute("aria-label")?.startsWith("Abrir post")));

// Carrossel
await cell(/Abrir carrossel/).click();
await link.getByRole("dialog").waitFor();
check("o carrossel tem 3 imagens", (await link.locator('[aria-roledescription="slide"]').count()) === 3);
await link.getByRole("button", { name: "Próxima imagem" }).click();
await link.waitForFunction(() => document.querySelector('[aria-roledescription="carrossel"]')?.parentElement?.textContent?.includes("2/3"));
check("a seta avança para a imagem 2 de 3", true);
// Pedir ajuste (comentário obrigatório)
await link.getByRole("button", { name: "Pedir ajuste" }).click();
check("sem comentário o pedido de ajuste não é enviado", await link.getByRole("button", { name: "Enviar pedido" }).isDisabled());
await link.getByPlaceholder(/Trocar a foto/).fill("Trocar a segunda imagem por uma mais clara.");
await link.getByRole("button", { name: "Enviar pedido" }).click();
await link.getByText("Você pediu ajuste").waitFor();
check("o pedido de ajuste é enviado e a barra mostra o estado", true);
await link.getByRole("button", { name: "Posts" }).click();

// Reels: toca e usa Range
await cell(/Abrir Reels/).click();
await link.getByRole("dialog").locator("video").waitFor();
await link.screenshot({ path: join(OUT, "link-reels.png") });
await link.getByRole("button", { name: "Reproduzir vídeo" }).click();
if (canPlay) {
  await link.waitForFunction(() => {
    const v = document.querySelector("dialog, [role=dialog]")?.querySelector("video");
    return v && v.currentTime > 0.3 && !v.paused;
  });
  check("o Reels toca de verdade", true);
}
check("o navegador pediu o vídeo com Range (necessário no iPhone)", rangeRequests.length > 0, rangeRequests[0] ?? "");
await link.getByRole("button", { name: "Ligar o som" }).click();
check("o botão de som alterna", (await link.getByRole("button", { name: "Desligar o som" }).count()) === 1);
await link.getByRole("button", { name: "Posts" }).click();

// Aprovar o post único
await cell(/Abrir post: Post único/).click();
await link.getByRole("button", { name: "Aprovar", exact: true }).click();
await link.getByText("Aprovado ✓").waitFor();
check("aprovar mostra os dias que o post ainda fica no link", (await link.getByText(/continua aqui por mais 3 dias/).count()) === 1);
await link.screenshot({ path: join(OUT, "link-aprovado.png") });
await link.getByRole("button", { name: "Posts" }).click();

// Recarregar mantém os estados
await link.reload();
check("ao recarregar, o estado de cada post continua", (await cell(/Abrir post: Post único.*Aprovado/).count()) === 1 && (await cell(/Abrir carrossel.*Ajuste pedido/).count()) === 1);

/* ───── Equipe vê as decisões ───── */
await page.goto(`${BASE}/clientes/${orgId}/conteudo`);
const fila = (await page.locator("section:has-text('Precisa de ação')").first().innerText()).replace(/\s+/g, " ");
check("a fila 'Precisa de ação' mostra a aprovação e o pedido de ajuste com o comentário", /precisa de ação \(2\)/i.test(fila) && fila.includes("Aprovou · Post único") && fila.includes("Pediu ajuste · Carrossel de pães") && fila.includes("Trocar a segunda imagem por uma mais clara."));
await page.goto(`${BASE}/clientes`);
check("a lista de Clientes mostra o indicador", /2 precisa\(m\) de ação/i.test(await page.locator(`a:has-text("${empresa}")`).innerText()));
await page.goto(`${BASE}/clientes/${orgId}/conteudo`);
await page.getByRole("button", { name: "Marcar como tratado" }).first().click();
await page.getByText(/precisa de ação \(1\)/i).waitFor();
check("marcar como tratado tira da fila", true);

/* ───── Janela de 3 dias ───── */
sql(`update content_post set approved_at = now() - interval '73 hours' where organization_id='${orgId}' and title='Post único'`);
await link.reload();
check("73 h depois da aprovação o post sai do link", (await link.locator("ul button").count()) === 2 && (await cell(/Abrir post: Post único/).count()) === 0);
await page.goto(`${BASE}/clientes/${orgId}/conteudo`);
check("…mas a equipe continua com ele em Ativos", (await page.locator("section[aria-label='Posts'] li:has-text('Post único')").count()) === 1);
sql(`update content_post set approved_at = now() - interval '70 hours' where organization_id='${orgId}' and title='Post único'`);
await link.reload();
check("com 70 h o post ainda aparece no link", (await link.locator("ul button").count()) === 3);

/* ───── Painel do cliente logado: mesma prévia ───── */
const panelCtx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
const panel = await panelCtx.newPage();
panel.setDefaultTimeout(45000);
check("o cliente entra com a senha gerada", await login(panel, clientEmail, clientPassword));
await panel.goto(`${BASE}/conteudo`);
check("a aba Conteúdo do cliente mostra a mesma prévia", (await panel.locator("ul button").count()) === 3 && (await panel.getByRole("button", { name: /Abrir Reels/ }).count()) === 1);
await panel.getByRole("button", { name: /Abrir Reels/ }).click();
await panel.getByRole("dialog").locator("video").waitFor();
await panel.getByRole("button", { name: "Aprovar", exact: true }).click();
await panel.getByText("Aprovado ✓").waitFor();
check("aprovar pelo painel funciona", true);
await page.goto(`${BASE}/clientes/${orgId}/conteudo`);
check("…e aparece na fila da equipe", (await page.locator("section:has-text('Precisa de ação')").first().innerText()).includes("Aprovou · Reels da fornada"));

/* ───── Gerar link novo ───── */
page.once("dialog", (d) => d.accept());
await page.getByRole("button", { name: "Gerar link novo" }).click();
await page.waitForFunction((old) => !document.querySelector("p.font-mono")?.textContent?.includes(old), token);
const newToken = (await page.locator("p.font-mono").first().innerText()).match(/\/p\/([A-Za-z0-9_-]{24})$/)[1];
check("gerar link novo troca o código", newToken !== token);
const fileKey = sql(`select file_key from content_media where organization_id='${orgId}' limit 1`);
const oldPage = await guest.newPage();
await oldPage.goto(`${BASE}/p/${token}`);
const randomPage = await guest.newPage();
await randomPage.goto(`${BASE}/p/${"a".repeat(24)}`);
const oldText = (await oldPage.locator("body").innerText()).trim();
const randomText = (await randomPage.locator("body").innerText()).trim();
check("o link antigo e um código qualquer mostram a mesma página neutra", oldText === randomText && /indispon/i.test(oldText) && !oldText.includes("lojadoze"), JSON.stringify(oldText.slice(0, 60)));
const oldFile = await guest.request.get(`${BASE}/p/${token}/arquivo/${fileKey}`);
const newFile = await guest.request.get(`${BASE}/p/${newToken}/arquivo/${fileKey}`);
const apiFile = await guest.request.get(`${BASE}/api/conteudo/arquivos/${fileKey}`);
check("arquivos: link antigo 404, link novo 200, rota do painel sem login 404", oldFile.status() === 404 && newFile.status() === 200 && apiFile.status() === 404, `${oldFile.status()}/${newFile.status()}/${apiFile.status()}`);
const decisionOld = await guest.request.post(`${BASE}/p/${token}/decisao`, { data: { postId: "x", decision: "aprovar" } });
check("decidir pelo link antigo dá 404", decisionOld.status() === 404);

/* ───── Celular (360 px) ───── */
const phone = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
const m = await phone.newPage();
m.setDefaultTimeout(45000);
await m.goto(`${BASE}/p/${newToken}`);
check("no celular não há rolagem horizontal", await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
await m.getByRole("button", { name: /Abrir carrossel/ }).tap();
await m.getByRole("dialog").waitFor();
const box = await m.getByRole("button", { name: "Pedir outro ajuste" }).boundingBox();
check("no celular a barra de decisão fica visível na tela", box !== null && box.y + box.height <= 740 + 1);
check("no celular o diálogo ocupa a tela inteira", await m.getByRole("dialog").evaluate((el) => el.getBoundingClientRect().width === window.innerWidth));
await m.screenshot({ path: join(OUT, "link-celular.png") });

await browser.close();
console.log(JSON.stringify({ orgId, token, newToken, empresa, stamp }));
console.log(consoleErrors.length || linkErrors.length ? "Erros no console: " + [...consoleErrors, ...linkErrors].join(" | ") : "Sem erros no console.");
const failed = results.filter((r) => !r).length;
console.log(failed ? `${failed} verificação(ões) falharam.` : `Todas as ${results.length} verificações passaram.`);
process.exit(failed ? 1 : 0);
