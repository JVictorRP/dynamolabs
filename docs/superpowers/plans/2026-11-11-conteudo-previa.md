# Conteúdo e prévia para o cliente — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A equipe monta o conteúdo do Instagram de cada cliente no painel e o cliente vê a prévia (celular, grade, post, carrossel e Reels) por um link fixo, sem acesso ao CRM, e aprova ou pede ajuste.

**Architecture:** Tudo em `apps/crm`. Lógica em `src/lib/content/*` sem dependência do Next (banco, armazenamento e relógio injetáveis, testável com PGlite e diretório temporário). Rotas e páginas finas por cima. Arquivos no disco do VPS (volume `/data`) atrás de uma interface de armazenamento. Tabelas novas no pacote `@dynamo/db`. A visibilidade dos 3 dias é calculada na leitura (sem rotina agendada).

**Tech Stack:** Next 16.4.5, Drizzle + Postgres 16 (PGlite nos testes), Vitest 3, Better Auth, Resend (HTTP), Playwright para a verificação no navegador.

**Spec:** `docs/superpowers/specs/2026-11-11-conteudo-previa-design.md`

## Global Constraints

- Branch `feat/content-preview` (parte de `feat/crm-clientes`). Nunca na `main`. Mensagens de commit em português, terminando com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Toda tabela nova tem `organization_id` (FK `organization.id`, `on delete cascade`); toda consulta filtra por ele.
- Status de post: `rascunho`, `em_aprovacao`, `ajuste_pedido`, `aprovado`, `agendado`, `publicado`. Tipos de evento: `enviado`, `aprovado`, `ajuste_pedido`, `editado`, `arquivado`, `reaberto`.
- **Visibilidade no link:** `archived_at` nulo **e** (status `em_aprovacao` ou `ajuste_pedido`, **ou** status `aprovado`/`agendado`/`publicado` com `approved_at` há menos de 72 horas). Rascunho nunca aparece.
- Código do link: 24 caracteres base64url (18 bytes aleatórios). Uma linha ativa por empresa (`revoked_at` nulo).
- Arquivos: JPG, PNG, WebP até 10 MB; MP4 (H.264) até 200 MB; carrossel até 10 imagens; legenda até 2.200 caracteres; comentário de ajuste até 1.000. Tipo conferido pelos primeiros bytes, nunca pela extensão nem pelo `Content-Type`.
- Chave de arquivo: `<uuid>.<jpg|png|webp|mp4>`; diretório `${CONTENT_DIR:-/data/content}/<organization_id>/`. Nome enviado pelo usuário nunca vira caminho.
- Limites de taxa por IP (janela de 10 min): página e arquivos do link 300; decisões 20. IP = a entrada de `X-Forwarded-For` que o último proxy confiável (Traefik, 1 salto) acrescentou.
- Resposta para código desconhecido, revogado ou arquivo de outro cliente: **a mesma** `404` neutra, sem corpo que diferencie.
- Aviso por e-mail: um por empresa, quando o aviso pendente mais antigo tem 10 minutos ou mais; texto puro; Resend `POST https://api.resend.com/emails`, remetente `Dynamo <avisos@mail.dynamo.business>`. Variáveis: `RESEND_API_KEY`, `DYNAMO_NOTIFY_EMAILS` (vírgulas), `CONTENT_NOTIFY_WEBHOOK_URL` (opcional), `CONTENT_DIR`. Sem chave ou lista, o e-mail não sai e o resto funciona.
- Mensagem pronta para o cliente (exata): `Olá! Seus próximos posts estão prontos para você ver e aprovar: {link}\nToque em cada post para ver a prévia e aprove ou peça ajuste.`
- Legendas e comentários são texto puro. Nenhum teste chama Resend, n8n ou rede de verdade.
- Entrega de arquivos pela sessão: equipe (`DYNAMO_STAFF_EMAILS`) **ou** membro da empresa dona do arquivo (a aba Conteúdo do cliente logado precisa).

## Review Focus

1. **Isolamento dos arquivos:** o código da empresa A pedindo arquivo ou post da empresa B recebe a mesma `404` neutra de um código inexistente. Teste na Task 5.
2. **Bordas de estado:** 71h59 e 72h01, aprovar post oculto ou rascunho, aprovar duas vezes (um só evento), aprovar depois de pedir ajuste, e reabrir. Testes na Task 3.
3. **Envio malicioso:** tipo falso com extensão certa, `Content-Type` mentindo, corpo acima do limite com e sem `Content-Length`, `../` no nome, e arquivo parcial apagado quando o envio é cortado. Testes na Task 4.
4. **Vídeo com `Range`:** `bytes=0-`, intervalo no meio, sufixo `bytes=-500`, intervalo inválido (`416`); o iPhone exige isso para tocar. Testes na Task 4.
5. **Aviso por e-mail:** reinício entre o evento e o envio, e-mail duplicado, falha do Resend sem perder avisos nem travar a decisão do cliente. Testes na Task 8.

---

### Task 1: Formulário "Gerar nova senha" no `/admin`

Recupera a conta de teste do João sem precisar de outra conta. Independe do resto.

**Files:**
- Modify: `apps/crm/src/lib/accounts.ts`, `apps/crm/src/app/admin/actions.ts`, `apps/crm/src/app/admin/chatbot-forms.tsx` (ou novo `apps/crm/src/app/admin/senha-form.tsx`), `apps/crm/src/app/admin/page.tsx`
- Test: `apps/crm/tests/accounts.test.ts`

**Interfaces:**
- Produces: `resetPasswordByEmail(deps: AccountDeps, email: string): Promise<{ login: string; senha: string }>`; lança `AccountError("Nenhum usuário com este e-mail.")` se não existir. Troca a senha, encerra as sessões. A senha tem o formato de `generatePassword()`.
- Produces: `resetarSenhaAction(prev: AdminFormState, fd: FormData): Promise<AdminFormState>` protegida pelo `ADMIN_TOKEN` (mesma checagem das outras ações do `/admin`); a mensagem de sucesso mostra e-mail e senha uma única vez.

- [ ] **Step 1: Testes que falham** em `accounts.test.ts`: `resets by e-mail: the old password stops working, the new one works, sessions end`; `refuses an unknown e-mail`; `ignores case and spaces in the e-mail`.
- [ ] **Step 2:** `pnpm --filter crm test`. Expected: FAIL (`resetPasswordByEmail` não existe).
- [ ] **Step 3:** Implementar `resetPasswordByEmail` reutilizando `updatePassword` e `deleteUserSessions`; a action e o formulário (padrão visual dos outros formulários do `/admin`, usando `useKeepValues`).
- [ ] **Step 4:** `pnpm --filter crm test && pnpm --filter crm typecheck`. Expected: PASS.
- [ ] **Step 5:** Verificar no navegador (CRM dev + Postgres local): cadastrar um usuário, gerar nova senha pelo `/admin`, entrar com a nova, ver que a antiga é recusada.
- [ ] **Step 6:** Commit `feat(crm): gerar nova senha pelo /admin`.

### Task 2: Esquema do conteúdo

**Files:**
- Create: `packages/db/src/content-schema.ts` (reexportado por `schema.ts`), `packages/db/tests/content-schema.test.ts`
- Modify: `packages/db/src/schema.ts` (enum e colunas de `content_post`)
- Generate: `apps/crm/drizzle/0003_*.sql`

**Interfaces:**
- Produces: enum `content_status` com o valor novo `ajuste_pedido`; em `content_post`: `approvedAt`, `archivedAt` (timestamps, nulos).
- Produces: `contentMedia` (`postId`, `kind` `image|video`, `position`, `fileKey`, `mime`, `bytes`, `isCover`, `alt`; único `(postId, position)`), `contentProfile` (PK `organization_id`; `handle`, `displayName`, `avatarFileKey`, `bio`, `link`), `contentShare` (`token` único, `createdAt`, `revokedAt`; índice único parcial por empresa onde `revoked_at is null`), `contentEvent` (`postId`, `type`, `text`, `createdAt`, `handledAt`), `contentNotice` (`eventId`, `createdAt`, `sentAt`).

- [ ] **Step 1: Testes que falham** em `content-schema.test.ts`: `accepts the ajuste_pedido status`; `allows only one active share per organization but many revoked`; `rejects two media at the same position of a post`; `deletes media, events and notices with the post and everything with the organization`.
- [ ] **Step 2:** `pnpm --filter @dynamo/db test`. Expected: FAIL.
- [ ] **Step 3:** Escrever o esquema e gerar a migração (`pnpm drizzle-kit generate --name conteudo` em `apps/crm`). Conferir o SQL gerado: o `ALTER TYPE … ADD VALUE` não pode ser usado na mesma transação em que é criado; se o migrador do PGlite ou do Postgres reclamar, separar em duas migrações e registrar um Ruling.
- [ ] **Step 4:** `pnpm --filter @dynamo/db test && pnpm --filter crm typecheck`, e aplicar as migrações num `postgres:16-alpine` (Docker). Expected: PASS e migrações aplicadas.
- [ ] **Step 5:** Commit `feat(db): tabelas de conteúdo, link e eventos`.

### Task 3: Núcleo — visibilidade, link, posts e decisões

**Files:**
- Create: `apps/crm/src/lib/content/{visibility,share,posts,decisions}.ts`
- Test: `apps/crm/tests/content-core.test.ts` (PGlite, como `accounts.test.ts`)

**Interfaces:**
- Consumes: `Db`, `schema`, tabelas da Task 2.
- Produces:
  - `HIDE_AFTER_MS = 72 * 3600_000`; `isVisibleToClient(post: { status: string; approvedAt: Date | null; archivedAt: Date | null }, now: Date): boolean`
  - `getActiveShare(db, orgId): Promise<{ token: string } | null>`; `ensureShare(db, orgId): Promise<{ token: string }>` (cria se não houver); `regenerateShare(db, orgId): Promise<{ token: string }>` (revoga o ativo e cria outro, numa transação); `resolveShare(db, token: string): Promise<{ organizationId: string } | null>` (só ativo)
  - `createPost(db, orgId, input: { format: "feed"|"carrossel"|"reels"; title?: string; caption?: string; scheduledAt?: Date | null }): Promise<Post>`; `updatePost(db, orgId, postId, patch)` (grava evento `editado` se já estava em aprovação ou aprovado); `setStatus(db, orgId, postId, status: "em_aprovacao"|"agendado"|"publicado")` (`em_aprovacao` grava `enviado` e limpa `approved_at`); `reopenPost(db, orgId, postId)` (volta a `em_aprovacao`, zera `approved_at`, evento `reaberto`); `archivePost(db, orgId, postId)`; `listPostsForStaff(db, orgId, { archived: boolean })`; `listPostsForClient(db, orgId, now)` (só visíveis, com mídias ordenadas e `daysLeft`); `deletePost(db, storage, orgId, postId)` (apaga as linhas e remove os arquivos do `storage`, interface da Task 4 passada por parâmetro)
  - `type ContentEventInfo = { organizationId: string; organizationName: string; postId: string; postTitle: string | null; type: "aprovado" | "ajuste_pedido"; text: string | null; at: Date }`
  - `type Decision = "aprovar" | "ajuste"`; `decide(db, deps: { now: () => Date; onEvent?: (e: ContentEventInfo) => void }, input: { organizationId; postId; decision; comment?: string }): Promise<"ok" | "ja_decidido" | "indisponivel">`. Regras: só decide post visível em `em_aprovacao` ou `ajuste_pedido`; aprovar grava `approved_at`, status `aprovado`, evento `aprovado` e um `content_notice`; ajuste exige comentário não vazio (até 1.000), grava `ajuste_pedido` e o evento com o texto; aprovar quem já está `aprovado` devolve `ja_decidido` sem novo evento; post rascunho, arquivado, de outra empresa ou fora da janela devolve `indisponivel`.
  - `listPendingActions(db, orgId | null): Promise<EventRow[]>` (eventos `aprovado` e `ajuste_pedido` sem `handled_at`); `markHandled(db, orgId, eventId)`; `countPendingActions(db): Promise<Record<string, number>>`.

- [ ] **Step 1: Testes que falham** em `content-core.test.ts`: `a post is visible at 71h59 and hidden at 72h01 after approval`; `drafts and archived posts never reach the client`; `approved, scheduled and published share the 72 h window`; `em_aprovacao and ajuste_pedido are visible with no deadline`; `approving twice records one event and returns ja_decidido`; `an adjustment without a comment is refused`; `approving after asking for adjustment works`; `deciding a hidden, draft or other organization's post returns indisponivel`; `each decision creates a notice and calls onEvent`; `reopening clears the approval and the post is visible again`; `regenerating the link revokes the old token`; `resolveShare returns null for unknown or revoked tokens`; `deletePost removes rows and asks the storage to remove the files`; `lists never return another organization's posts`.
- [ ] **Step 2:** `pnpm --filter crm test content-core`. Expected: FAIL.
- [ ] **Step 3:** Implementar os módulos. `isVisibleToClient` é pura e usada nas consultas (a consulta aplica a mesma regra em SQL; um teste garante que as duas concordam).
- [ ] **Step 4:** `pnpm --filter crm test && pnpm --filter crm typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(crm): núcleo do conteúdo — visibilidade, link e decisões`.

### Task 4: Armazenamento e arquivos

**Files:**
- Create: `apps/crm/src/lib/content/{storage,files}.ts`, `apps/crm/src/app/api/conteudo/arquivos/route.ts`, `apps/crm/src/app/api/conteudo/arquivos/[key]/route.ts`
- Modify: `Dockerfile.crm` (cria `/data/content` com dono `app`; `ENV CONTENT_DIR=/data/content`), `apps/crm/src/lib/content/posts.ts` (`attachMedia`)
- Test: `apps/crm/tests/content-files.test.ts` (diretório temporário; sem Next)

**Interfaces:**
- Produces:
  - `interface ContentStorage { put(organizationId: string, key: string, data: ReadableStream<Uint8Array>, opts: { maxBytes: number }): Promise<{ bytes: number }>; open(organizationId: string, key: string, range?: { start: number; end: number }): Promise<{ stream: ReadableStream<Uint8Array>; size: number } | null>; remove(organizationId: string, key: string): Promise<void>; usage(organizationId?: string): Promise<number> }`
  - `createFsStorage(root: string): ContentStorage`; chaves e IDs validados por expressão regular (`^[0-9a-f-]{36}\.(jpg|png|webp|mp4)$` e UUID); `put` escreve num arquivo temporário e só renomeia ao terminar; interrompido ou acima do limite, apaga o temporário.
  - `detectKind(head: Uint8Array): { kind: "image" | "video"; ext: "jpg"|"png"|"webp"|"mp4"; mime: string } | null`
  - `class FileError extends Error { code: "tipo" | "tamanho" | "chave" | "vazio" }`
  - `saveUpload(storage, input: { organizationId: string; body: ReadableStream<Uint8Array> | null; contentLength: number | null }): Promise<{ key: string; kind: "image"|"video"; mime: string; bytes: number }>` (confere tipo pelos primeiros bytes, limite por tipo com e sem `Content-Length`)
  - `serveFile(storage, input: { organizationId: string; key: string; range: string | null }): Promise<Response>` (`200`/`206`/`416`, `Accept-Ranges: bytes`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, max-age=3600`; `404` neutra se não existir)
  - `attachMedia(db, storage, orgId, postId, input: { body; contentLength; isCover?: boolean; alt?: string }): Promise<MediaRow>` (valida: formato do post × tipo do arquivo — Reels aceita 1 vídeo e 1 capa; carrossel até 10 imagens; post único 1 imagem; posição = próxima livre) e `findFileOwner(db, key): Promise<string | null>` (empresa dona pelo `content_media` ou pelo avatar do perfil).
  - `setAvatar(db, storage, orgId, input: { body; contentLength }): Promise<{ key: string }>` (só imagem; troca a foto do perfil e remove o arquivo anterior do disco)
  - Rotas: `POST /api/conteudo/arquivos?postId=…&cover=1` (sessão da equipe; corpo = arquivo cru; devolve a linha de mídia) e `POST /api/conteudo/arquivos?avatar=1&orgId=…` (foto do perfil) e `GET /api/conteudo/arquivos/<key>` (equipe, ou membro da empresa dona).

- [ ] **Step 1: Testes que falham** em `content-files.test.ts`: `detects jpg, png, webp and mp4 by the first bytes`; `rejects a text file named .jpg`; `rejects a lying Content-Type` (o tipo vem dos bytes); `rejects an upload above the limit with and without Content-Length and leaves no file behind`; `removes the partial file when the stream is cut`; `rejects keys with ../ or other organizations' ids`; `Range: bytes=0- returns 206 with the whole file`; `a middle range, a suffix range (bytes=-500) and an open range work`; `an invalid range returns 416`; `serving a missing file returns the neutral 404`; `reels accepts one video plus one cover and refuses a second video`; `carousel refuses the 11th image`; `the avatar accepts only images and replaces the previous file on disk`; `usage sums the bytes of an organization`.
- [ ] **Step 2:** `pnpm --filter crm test content-files`. Expected: FAIL.
- [ ] **Step 3:** Implementar as bibliotecas, depois as rotas finas (autorização por `requireStaff`/sessão, `Request` → funções acima) e o Dockerfile. Adicionar `checkWritable(dir): Promise<void>` em `storage.ts`, que cria e apaga um arquivo de teste e lança com mensagem clara (usada na Task 8).
- [ ] **Step 4:** `pnpm --filter crm test && pnpm --filter crm typecheck && (cd apps/crm && pnpm lint)`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(crm): armazenamento de arquivos do conteúdo com validação e Range`.

### Task 5: Limite de taxa e rotas do link

**Files:**
- Create: `apps/crm/src/lib/rate-limit.ts`, `apps/crm/src/lib/content/link.ts`, `apps/crm/src/app/p/[token]/arquivo/[key]/route.ts`, `apps/crm/src/app/p/[token]/decisao/route.ts`
- Modify: `apps/crm/src/proxy.ts` (liberar `/p/…` sem login)
- Test: `apps/crm/tests/content-link.test.ts`

**Interfaces:**
- Consumes: `resolveShare`, `isVisibleToClient`, `decide`, `serveFile`, `findFileOwner` (Tasks 3 e 4).
- Produces:
  - `createRateLimiter(opts: { windowMs: number; max: number; now: () => number }): { hit(ip: string): boolean }` (acompanha no máximo 10.000 IPs; passou disso, recusa novos)
  - `clientIp(headers: Headers, trustedHops = 1): string`
  - `serveLinkFile(deps: { db; storage; limiter; now }, input: { token: string; key: string; ip: string; range: string | null }): Promise<Response>`: confere o código, confere que o arquivo pertence a um post **visível** daquela empresa; `404` neutra em qualquer outro caso; `429` quando o limite estoura.
  - `handleLinkDecision(deps: { db; limiter; now; onEvent }, input: { token: string; ip: string; body: unknown }): Promise<Response>`: valida `{ postId, decision, comment? }`; responde `200 {resultado}`, `400`, `404` neutra, `429`.
  - `proxy.ts`: o `matcher` passa a excluir `p/` (e só ele, para não liberar rotas do painel).

- [ ] **Step 1: Testes que falham** em `content-link.test.ts`: `the token of organization A never serves a file of organization B` (resposta idêntica à de código inexistente: mesmo status, mesmos cabeçalhos, mesmo corpo); `a revoked token answers the same neutral 404`; `a file of a hidden post (draft, archived, past 72 h) is not served through the link`; `files of visible posts are served with Range`; `decisions only work on posts the link shows`; `the limiter blocks the 21st decision from one IP and not another IP`; `clientIp takes the entry added by the last trusted proxy and ignores forged leading ones`; `the proxy matcher lets /p/abc through and still protects /painel-like routes` (testar a expressão do `matcher` com amostras de caminho).
- [ ] **Step 2:** `pnpm --filter crm test content-link`. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `pnpm --filter crm test && pnpm --filter crm typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(crm): rotas públicas do link de prévia com limite por IP`.

### Task 6: Componentes da prévia

**Files:**
- Create: `apps/crm/src/components/content/preview-model.ts`, `apps/crm/src/components/content/content-preview.tsx` (cliente), `phone-frame.tsx`, `post-view.tsx`, `reels-view.tsx`, `decision-bar.tsx`
- Test: `apps/crm/tests/preview-model.test.ts`

**Interfaces:**
- Produces:
  - `truncateCaption(text: string, max = 125): { visible: string; truncated: boolean }` (corta em palavra inteira e conta como o Instagram: quebras de linha contam; texto vazio devolve vazio)
  - `STATUS_LABEL: Record<string, string>` (rótulos em português dos seis status), `daysLeft(approvedAt: Date | null, now: Date): number | null` (dias inteiros restantes dos 3, nunca negativo)
  - `<ContentPreview profile posts fileBase mode onDecide />` com `mode: "client" | "staff"`; `posts` já traz mídias; `fileBase` é o prefixo dos endereços de arquivo (`/p/<código>/arquivo` ou `/api/conteudo/arquivos`); `onDecide(postId, decision, comment?)` retorna uma promessa.
- Comportamento: moldura de celular no computador e tela cheia abaixo de 640 px; cabeçalho de perfil (foto, @, número de posts, bio); grade de 3 colunas com ícones de carrossel e Reels e etiqueta de status; toque abre `PostView` (imagem ou carrossel com deslizar, setas e pontos; legenda com "mais"; data prevista) ou `ReelsView` (9:16, play/pausa, som, legenda sobre o vídeo); `DecisionBar` fixa com **Aprovar** e **Pedir ajuste** (comentário obrigatório); estado vazio "Nenhum post para aprovar". No modo `staff` a barra de decisão não aparece. Teclado, `alt`, rótulos acessíveis, tema escuro da marca.

- [ ] **Step 1: Testes que falham** em `preview-model.test.ts`: `truncateCaption cuts at a whole word and marks truncated`; `keeps short captions and empty ones intact`; `daysLeft counts whole days from the 3-day window and never goes negative`; `STATUS_LABEL covers every status`.
- [ ] **Step 2:** `pnpm --filter crm test preview-model`. Expected: FAIL.
- [ ] **Step 3:** Implementar o modelo e os componentes (design da marca: `bg-void`, `bg-panel`, `text-mist`, teal e âmbar; sem bibliotecas novas). Acessibilidade conferida na Task 9.
- [ ] **Step 4:** `pnpm --filter crm test && pnpm --filter crm typecheck && (cd apps/crm && pnpm lint)`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(crm): componentes da prévia de conteúdo (celular, grade, post, carrossel e Reels)`.

### Task 7: Telas da equipe

**Files:**
- Create: `apps/crm/src/app/clientes/[id]/conteudo/{page.tsx,actions.ts,forms.tsx}`
- Modify: `apps/crm/src/app/clientes/[id]/page.tsx` (atalho para Conteúdo), `apps/crm/src/lib/accounts.ts` (`listClients` ganha `pendingActions`), `apps/crm/src/app/clientes/page.tsx` (indicador)
- Test: `apps/crm/tests/accounts.test.ts` (indicador); resto no navegador (Task 9)

**Interfaces:**
- Consumes: Tasks 3, 4 e 6; `requireStaff()`.
- Produces: `ClientRow.pendingActions: number`; actions (todas começam por `requireStaff()` e conferem que o post pertence à empresa da URL): `saveProfileAction`, `createPostAction`, `updatePostAction`, `setStatusAction`, `reopenPostAction`, `archivePostAction`, `deletePostAction`, `regenerateLinkAction`, `markHandledAction`.
- Tela: **Perfil** (formulário com foto enviada pela rota de arquivos, tratada como mídia do perfil); **Link** (cartão com o endereço, "Copiar link", "Copiar mensagem" com o texto exato das constantes, "Gerar link novo" com confirmação); **Precisa de ação** (fila com comentário do cliente e "Marcar como tratado"); **Posts** (abas Ativos e Arquivados; criar e editar com formato, arrastar arquivos com barra de progresso pelo `fetch` à rota de upload, ordem e capa, legenda com contador de 2.200, título interno, data); ações por post; **Ver como o cliente vê** (`ContentPreview` em modo `staff`); **Espaço usado** (`storage.usage`).

- [ ] **Step 1: Teste que falha** em `accounts.test.ts`: `listClients counts pending client actions per company` (um aprovado e um ajuste não tratados somam 2; tratados não contam; outra empresa não entra).
- [ ] **Step 2:** `pnpm --filter crm test accounts`. Expected: FAIL.
- [ ] **Step 3:** Implementar `pendingActions`, as actions e as telas.
- [ ] **Step 4:** `pnpm --filter crm test && pnpm --filter crm typecheck && (cd apps/crm && pnpm lint)`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(crm): painel de conteúdo da equipe`.

### Task 8: Avisos (painel, webhook e e-mail) e inicialização

**Files:**
- Create: `apps/crm/src/lib/content/{notify,digest,resend}.ts`, `apps/crm/src/instrumentation.ts`
- Test: `apps/crm/tests/content-notify.test.ts`

**Interfaces:**
- Consumes: `content_notice`, `content_event`, `checkWritable` (Task 4).
- Produces:
  - `notifyWebhook(url: string | undefined, payload: ContentEventInfo, fetchFn: typeof fetch): Promise<void>` (melhor esforço, 5 s de limite, nunca lança)
  - `createResendSender(opts: { apiKey: string; from: string; fetch?: typeof fetch }): (to: string[], subject: string, text: string) => Promise<void>` (lança em erro HTTP)
  - `flushDigests(db, deps: { now: () => Date; send: (to: string[], subject: string, text: string) => Promise<void>; recipients: string[]; loginUrl: string }): Promise<{ sent: number }>`: para cada empresa com aviso não enviado cujo mais antigo tem 10 minutos ou mais, monta **um** e-mail em texto puro (empresa, quantos aprovados e quantos pedem ajuste, os comentários, link para a aba Conteúdo da empresa) e marca todos como enviados **só depois** do envio concluir; falha deixa tudo pendente.
  - `instrumentation.ts`: `register()` (só no runtime Node): roda `checkWritable(CONTENT_DIR)` e escreve o resultado no log; liga um temporizador de 60 s que chama `flushDigests` (sem chave ou lista, não envia). O webhook sai no momento do evento, via `onEvent` de `decide`.

- [ ] **Step 1: Testes que falham** em `content-notify.test.ts`: `three events in 10 minutes become one e-mail per company, not three`; `nothing is sent before the oldest notice is 10 minutes old`; `two companies get two separate e-mails`; `a Resend failure keeps the notices and the next run sends them`; `a restart between the event and the send loses nothing` (notices vivem no banco; novo `flushDigests` envia); `the same notice is never sent twice`; `the e-mail has no HTML and lists the comment text`; `the webhook is best effort: a failing or slow URL never throws and never blocks decide`; `without recipients nothing is sent and nothing is marked sent`.
- [ ] **Step 2:** `pnpm --filter crm test content-notify`. Expected: FAIL.
- [ ] **Step 3:** Implementar. Em `decide`, ligar `onEvent` ao webhook na rota do link e na action do painel.
- [ ] **Step 4:** `pnpm --filter crm test && pnpm --filter crm typecheck && (cd apps/crm && pnpm lint) && pnpm --filter crm build`. Expected: PASS. Conferir no `next build` que `instrumentation.ts` é carregado (o log do servidor mostra a verificação de gravação).
- [ ] **Step 5:** Commit `feat(crm): avisos de aprovação por painel, webhook e e-mail`.

### Task 9: Páginas do cliente e verificação ponta a ponta

**Files:**
- Create: `apps/crm/src/app/p/[token]/page.tsx`, `apps/crm/e2e/conteudo.mjs`, `apps/crm/tests/fixtures/{mini.png,mini.jpg,mini.mp4}` (MP4 H.264 de 1 s e até 50 KB, gerado com `ffmpeg`; se não estiver instalado, via `docker run jrottenberg/ffmpeg`)
- Modify: `apps/crm/src/app/(painel)/conteudo/page.tsx` (usa `ContentPreview` com `fileBase=/api/conteudo/arquivos`; decisão por server action que chama `decide` com a empresa da sessão)

**Interfaces:**
- Consumes: Tasks 3, 5, 6 e 8.
- Produces: `/p/<código>` (servidor): resolve o código, carrega `listPostsForClient` e o perfil, renderiza `ContentPreview` em modo `client` com `onDecide` apontando para `POST /p/<código>/decisao`; código inválido ou revogado chama `notFound()` (a mesma resposta nos dois casos); `robots: noindex`; cabeçalhos `Cache-Control: no-store` e `Referrer-Policy: no-referrer` (via `next.config.ts` `headers()` para `/p/:path*`).

- [ ] **Step 1:** Escrever `e2e/conteudo.mjs` (Playwright; CRM dev + Postgres local, volume em diretório temporário): a equipe cria perfil, um post com imagem, um carrossel de 3 imagens e um Reels (vídeo + capa); envia os três para aprovação; copia o link; **sem login**, abre o link; confere a grade com 3 posts, o ícone de carrossel e de Reels; abre o post (legenda cortada e "mais"), passa o carrossel, toca o vídeo (o servidor recebeu requisição com `Range`); pede ajuste num post (comentário) e aprova outro; confere a fila "Precisa de ação" da equipe e o indicador na lista de Clientes; simula 72 h (muda `approved_at` no banco) e confere que o post aprovado some do link e continua em "Ativos" para a equipe; a equipe arquiva um post e ele aparece em "Arquivados"; gera link novo e confere que o antigo dá a página neutra; confere em 360 px sem rolagem horizontal.
- [ ] **Step 2:** Rodar contra o código: Expected: FALHA nos passos que dependem das páginas ainda não feitas.
- [ ] **Step 3:** Implementar a página do link, a troca da aba Conteúdo do cliente logado e os cabeçalhos.
- [ ] **Step 4:** Rodar o roteiro até passar. Conferir capturas de tela em celular e computador, o texto alternativo e o uso só com teclado.
- [ ] **Step 5:** Commit `feat(crm): página pública da prévia e aba Conteúdo do cliente com a mesma prévia`.

### Task 10: Documentação, verificação completa e integração

**Files:**
- Modify: `docs/VPS-SETUP.md` (volume `/data`, Resend e DNS de `mail.dynamo.business`, variáveis novas), `.env.example`, `docs/ARQUITETURA.md`, `README.md`

- [ ] **Step 1:** Documentar: passo a passo do volume no Easypanel (aba Mounts, tipo Volume, nome `conteudo`, caminho `/data`), criação da conta e do domínio no Resend, registros de DNS, `RESEND_API_KEY`, `DYNAMO_NOTIFY_EMAILS`, `CONTENT_NOTIFY_WEBHOOK_URL`, `DYNAMO_STAFF_EMAILS`.
- [ ] **Step 2:** Suíte completa: `pnpm test:bot && pnpm --filter crm test && pnpm --filter crm typecheck && (cd apps/crm && pnpm lint) && pnpm --filter crm build && pnpm --filter site test`. Expected: tudo verde.
- [ ] **Step 3:** `docker build -f Dockerfile.crm -t dynamo-crm-test .` e **teste de persistência**: subir o contêiner com um volume nomeado em `/data` e um Postgres local, enviar uma imagem pelo painel, parar e subir o contêiner de novo com o mesmo volume e conferir que o arquivo continua a ser servido; conferir também que o usuário do contêiner consegue gravar (o log da inicialização mostra a verificação).
- [ ] **Step 4: Parar e pedir confirmação do João Victor** antes de qualquer merge ou envio: o merge da `feat/crm-clientes` e depois da `feat/content-preview` na `main` dispara deploy do CRM. Só com o "sim" explícito: merge local, suíte na `main` resultante, `git push`.
