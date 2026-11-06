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
BETTER_AUTH_SECRET=<segredo 1>
DATABASE_URL=<Internal Connection URL do passo 3>
ADMIN_TOKEN=<segredo 2>
```

**Domains** → Add domain
- Host: `app.dynamo.business` · HTTPS: ligado · Port: **80** (o Easypanel define PORT=80 para o app)

Clique em **Deploy**. O primeiro build leva de 3 a 6 minutos. Nos logs do serviço devem aparecer `Migrações aplicadas.` e `Ready`.

Abra **https://app.dynamo.business** → tela de login.

**Deploy automático:** em *Source*, ative *Auto Deploy*. Cada atualização enviada ao GitHub publica sozinha.

## 5. Cadastrar clientes

**Jeito mais fácil:** abra **https://app.dynamo.business/admin**, cole o `ADMIN_TOKEN`, preencha empresa, contato, e-mail e senha e clique em *Cadastrar cliente*. A tela mostra o login e a chave do n8n. Marque "dados fictícios" para uma conta de demonstração.

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
