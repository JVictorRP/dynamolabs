# Colocar o CRM no ar pelo Easypanel

O VPS (KVM 2, srv814976) já roda o **Easypanel**, que gerencia o Traefik, o SSL e o n8n (serviço `n8n` do projeto `dynamo`). O CRM entra no mesmo projeto, com dois serviços novos: **crm-db** (Postgres) e **crm** (o app).

Painel: `http://168.231.100.173:3000`

> ⚠️ Não instale Coolify nem troque o sistema operacional: o Easypanel já cumpre esse papel, e trocar apagaria o n8n.

## 0. Snapshot

Hostinger → VPS → **Backups e monitoramento** → criar snapshot. Volta tudo em 1 clique se algo der errado.

## 1. DNS (Hostinger → Domínios → dynamo.business → DNS)

| Tipo | Nome | Aponta para |
|---|---|---|
| A | `app` | `168.231.100.173` |
| A | `@` | `168.231.100.173` *(para o site, na próxima etapa)* |
| CNAME | `www` | `dynamo.business` |

## 2. Ligar o GitHub ao Easypanel

1. No GitHub: **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
   - Repository access: *Only select repositories* → `dynamolabs`
   - Permissions → Repository → **Contents: Read-only** (e **Webhooks: Read and write**, para o deploy automático)
2. No Easypanel: **Settings → GitHub** → cole o token → Save.

## 3. Banco de dados

Projeto **dynamo** → **+ Service** → **Postgres**

- Service name: `crm-db`
- Database name: `dynamo`
- Password: deixe a gerada

Crie e, na tela do serviço, copie a **Internal Connection URL** (começa com `postgres://` e usa o host `dynamo_crm-db`). Ela vai no passo 4.

## 4. App do CRM

Projeto **dynamo** → **+ Service** → **App** → nome `crm`.

**Source → GitHub**
- Owner: `JVictorRP` · Repository: `dynamolabs` · Branch: `main` · Build path: `/`

**Build → Dockerfile**
- File: `Dockerfile.crm`

**Environment** (gere os segredos no Web console da Hostinger com `openssl rand -hex 32`, um para cada):

```
BETTER_AUTH_URL=https://app.dynamo.business
BETTER_AUTH_SECRET=COLE_O_SEGREDO_1
DATABASE_URL=COLE_A_INTERNAL_CONNECTION_URL
ADMIN_TOKEN=COLE_O_SEGREDO_2
DYNAMO_STAFF_EMAILS=SEU_EMAIL_DE_LOGIN
DYNAMO_NOTIFY_EMAILS=EMAILS_QUE_RECEBEM_OS_AVISOS_SEPARADOS_POR_VIRGULA
RESEND_API_KEY=COLE_A_CHAVE_DO_RESEND
```

O `RESEND_API_KEY` e o `DYNAMO_NOTIFY_EMAILS` só são necessários para o e-mail de avisos do conteúdo (seção 4.1). Sem eles o CRM funciona normalmente e o aviso fica só no painel.

Substitua o texto em MAIÚSCULAS pelo valor, sem aspas, espaços ou sinais `< >`.

**Domains** → Add domain
- Host: `app.dynamo.business` · HTTPS: ligado · Port: **80** (o Easypanel define PORT=80 para o app)

Clique em **Deploy**. O primeiro build leva de 3 a 6 minutos. Nos logs do serviço devem aparecer `Migrações aplicadas.` e `Ready`.

Abra **https://app.dynamo.business** → tela de login.

**Deploy automático:** em *Source*, ative *Auto Deploy*. Cada atualização enviada ao GitHub publica sozinha.

### 4.1. Conteúdo e prévia para o cliente (volume e e-mail de avisos)

A prévia dos posts guarda as imagens e os vídeos no disco do VPS. Sem o passo 1, o CRM sobe, mas **perde os arquivos a cada novo Deploy**.

**1. Volume para os arquivos** (uma vez)
- Serviço `crm` → aba **Mounts** → **Add Mount** → tipo **Volume** (não use *Bind* nem *File*).
- **Name:** `conteudo` · **Mount Path:** `/data`.
- Clique em **Implantar**. Nos logs do serviço deve aparecer `Arquivos do conteúdo: /data/content (gravação ok).` Se aparecer `ATENÇÃO — A pasta de arquivos do conteúdo ... não aceita gravação`, o volume não foi montado em `/data`.
- Teste: envie uma imagem em **Clientes → cliente → Conteúdo**, clique em **Implantar** de novo e confira que a imagem continua lá.
- O volume entra no backup semanal da Hostinger (seção 6), mas não tem backup externo próprio.

**2. E-mail de avisos pelo Resend (grátis)** — opcional
- Crie a conta em <https://resend.com> e, em **Domains**, adicione o domínio de envio **`mail.dynamo.business`** (um subdomínio, para não mexer em nenhum e-mail do domínio principal).
- Na Hostinger (DNS de `dynamo.business`), acrescente os registros que o Resend mostrar (SPF, DKIM e, se pedido, MX do subdomínio `mail`) e clique em **Verify** no Resend.
- Em **API Keys**, crie uma chave e cole em `RESEND_API_KEY`. Em `DYNAMO_NOTIFY_EMAILS`, liste os e-mails da equipe que devem receber os avisos.
- O plano grátis permite 3.000 e-mails por mês e 100 por dia. O CRM junta os avisos de cada cliente em **um e-mail a cada 10 minutos**, então o volume é pequeno.
- O remetente é `Dynamo <avisos@mail.dynamo.business>` (mude com `CONTENT_MAIL_FROM`).

**3. Webhook do n8n** — opcional
- Defina `CONTENT_NOTIFY_WEBHOOK_URL` com a URL (https) de um fluxo do n8n. Cada aprovação ou pedido de ajuste do cliente é enviado como JSON com `event` (`content.aprovado` ou `content.ajuste_pedido`), empresa, post e comentário. Se a URL falhar ou demorar, a decisão do cliente não é afetada.

**Como usar:** em **Clientes → cliente → Conteúdo** a equipe cria o perfil e os posts, envia para aprovação e copia a mensagem pronta com o link. O cliente abre o link no celular, sem login. Três dias depois de aprovado, o post sai do link do cliente e continua com a equipe.

## 5. Cadastrar clientes

**Jeito mais fácil:** entre no CRM com um e-mail listado em `DYNAMO_STAFF_EMAILS` e abra **Clientes** no menu (ou **https://app.dynamo.business/clientes**). Lá você cria a empresa com o primeiro acesso, adiciona mais pessoas e gera senha nova para quem esqueceu. A senha é gerada automaticamente e aparece uma única vez, com o botão *Copiar mensagem para o cliente*.

**Primeiro acesso da equipe (sem nenhuma conta ainda):** abra **https://app.dynamo.business/admin**, cole o `ADMIN_TOKEN` e cadastre a empresa da Dynamo com o seu e-mail. Depois use a área Clientes. A tela `/admin` continua servindo para ligar o WhatsApp de um cliente.

**Por API (n8n ou terminal):**

Pelo n8n (nó HTTP Request) ou por qualquer cliente HTTP:

- `POST https://app.dynamo.business/api/admin/clientes`
- Header `Authorization: Bearer <ADMIN_TOKEN>`
- Body JSON:

```json
{ "empresa": "Bacalhau Club", "nome": "Nome do contato", "email": "contato@cliente.com", "senha": "UmaSenhaForte2026" }
```

A resposta traz o login e a **chave de API do n8n** daquele cliente (só aparece nessa resposta). Acrescente `"demo": true` para criar uma conta de demonstração com dados fictícios.

Pelo Web console, o mesmo cadastro fica assim:

```bash
curl -X POST https://app.dynamo.business/api/admin/clientes \
  -H "Authorization: Bearer COLE_O_ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"empresa":"Dynamo Demo","nome":"João Victor","email":"seu@email.com","senha":"UmaSenhaForte2026","demo":true}'
```

## 6. Backups

Serviço **crm-db** → **Backups** → configure um destino fora do VPS (S3, Cloudflare R2, Backblaze) com frequência diária.

## 7. Segurança do painel

O Easypanel está aberto em `http://IP:3000`, sem cadeado. Em **Settings → General**, defina um domínio para o painel (ex.: `painel.dynamo.business`, com registro A no DNS) e ative a autenticação em dois fatores na sua conta.

## Se algo der errado

| Sintoma | Causa provável |
|---|---|
| Build falha em `pnpm install` | Repositório não autorizado no token do GitHub (passo 2) |
| Serviço reinicia sem parar | `DATABASE_URL` errada: confira se usa o host interno `dynamo_crm-db` |
| "Service is not reachable" | Porta do domínio diferente da do app: confira no log (`http://0.0.0.0:80`) e use a mesma em Domains |
| Erro de certificado | DNS do `app` ainda propagando (espere alguns minutos e clique em *Deploy* de novo) |
| Login dá "Invalid origin" | `BETTER_AUTH_URL` diferente do endereço aberto no navegador |
| `/api/admin/clientes` responde 401 | `ADMIN_TOKEN` vazio, curto (mínimo 32 caracteres) ou diferente do enviado |
