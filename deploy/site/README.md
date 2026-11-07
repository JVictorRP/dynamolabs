# Publicar o site (dynamo.business) no Easypanel

O site é estático: o build gera `apps/site/out` e o nginx o serve. No Easypanel ele é **um serviço novo** (`site`) no projeto
`dynamo`, ao lado de `crm`, `crm-db` e `n8n`. Não existe `docker-compose` aqui: o Traefik e o HTTPS são do Easypanel.

## Por que isto não interfere no CRM, no n8n nem no futuro chatbot

O Easypanel/Traefik escolhe o serviço pelo **nome do host** do endereço. Cada coisa tem o seu:

| Endereço | Serviço |
|---|---|
| `dynamo.business` (e `www`) | **site** (este) |
| `app.dynamo.business` | CRM |
| `n8n.dynamo.business` | n8n |
| `algo.dynamo.business` (futuro chatbot de IA) | serviço próprio, com o próprio subdomínio |

Verificado no código:
- **Sem cookies, sem armazenamento local, sem HSTS no site.** O nginx não envia `Strict-Transport-Security` (um HSTS com
  `includeSubDomains` no domínio principal forçaria HTTPS em todos os subdomínios). Os cookies de login do CRM são do
  próprio `app.dynamo.business` (a configuração do login não ativa cookie compartilhado entre subdomínios), então o site
  não os recebe e não consegue substituí-los.
- O site só responde pelos seus caminhos (`/`, `/privacidade`, `/termos`, `/frames`, `/fonts`, `/brand`, `/_next`, `/robots.txt`,
  `/sitemap.xml`). Nada de `/api` aqui: a API continua toda em `app.dynamo.business`.
- O único ponto de contato com o CRM é o formulário, que envia para `https://app.dynamo.business/api/public/lead`.
  O CRM só aceita essa rota vinda de `dynamo.business` e `www.dynamo.business` (CORS); as rotas `/api/v1/*`, `/api/auth/*`
  e `/api/admin/*` continuam como antes (conferido no build do CRM com a rota nova: sem chave → 401; sem sessão → login).

## O que NÃO fazer (é aqui que se interfere em outras aplicações)

- **DNS:** só crie/ajuste o registro `A` de `@` (e o `CNAME` de `www`). **Não apague nem troque** `A app`, `A n8n`,
  nem registros `MX`/`TXT` (e-mail, SPF, DKIM). Mexer no `A @` não afeta e-mail nem subdomínios.
- **Easypanel:** no serviço do site, cadastre **apenas** os domínios `dynamo.business` e `www.dynamo.business`. Não use
  domínio coringa (`*.dynamo.business`): ele capturaria os subdomínios do CRM, do n8n e do chatbot.
- Não reaproveite o serviço `crm`: o site é um serviço separado, para um deploy do site nunca reiniciar o CRM.

## Antes de subir

1. **Trava de lançamento:** `pnpm --filter site check:release` precisa passar. Ele bloqueia enquanto:
   - `COPY.status` (apps/site/src/content/copy.ts) for `provisional`;
   - `LEGAL.status` (apps/site/src/content/legal.ts) for `provisional` (privacidade e termos de uso);
   - faltar `NEXT_PUBLIC_LEAD_ENDPOINT` (https) ou `NEXT_PUBLIC_WHATSAPP_URL`.

   O `Dockerfile.site` roda a mesma checagem: com pendências o build da imagem falha de propósito (o log diz o que falta).
2. **CRM** (variáveis do serviço `crm`, depois **Deploy**):
   - `PUBLIC_LEAD_ORGANIZATION_ID` = id da organização Dynamo no CRM;
   - `PUBLIC_LEAD_ALLOWED_ORIGINS` = `https://dynamo.business,https://www.dynamo.business`.
3. **DNS** (Hostinger → Domínios → dynamo.business → DNS): `A @` → IP do VPS e `CNAME www` → `dynamo.business`
   (já descritos em `docs/VPS-SETUP.md`).

## Criar o serviço no Easypanel

Projeto **dynamo** → **+ Service** → **App** → nome `site`.

- **Source → GitHub:** `JVictorRP/dynamolabs`, branch `main`, Build path `/`.
- **Build → Dockerfile:** arquivo `Dockerfile.site`.
- **Environment:**
  ```
  NEXT_PUBLIC_LEAD_ENDPOINT=https://app.dynamo.business/api/public/lead
  NEXT_PUBLIC_WHATSAPP_URL=https://wa.me/55DDDNUMERO
  NEXT_PUBLIC_CONTACT_EMAIL=
  NEXT_PUBLIC_INSTAGRAM_URL=
  NEXT_PUBLIC_LINKEDIN_URL=
  ```
  As três últimas são opcionais. As variáveis `NEXT_PUBLIC_*` entram no JavaScript **no momento do build**: mudou uma, faça
  **Deploy** de novo. Se o build falhar dizendo que falta `NEXT_PUBLIC_LEAD_ENDPOINT` ou `NEXT_PUBLIC_WHATSAPP_URL`, o
  Easypanel não passou a variável ao build: ele precisa vir como *build argument* (confira em Build do serviço).
- **Domains:** `dynamo.business` e `www.dynamo.business`, HTTPS ligado, **Port 80**.
- **Deploy.** Auto Deploy pode ser ligado depois.

## Conferir (depois do deploy)

```bash
curl -sI https://dynamo.business/ | head -5                    # 200, cache-control: no-cache
curl -sI https://dynamo.business/frames/v1/desktop/0001.webp   # cache-control: ... immutable
curl -sI https://app.dynamo.business/login | head -3           # CRM segue respondendo (200)
curl -sI https://n8n.dynamo.business/ | head -3                # n8n segue respondendo
```

Depois envie uma mensagem pelo formulário e confira se o lead apareceu no CRM (origem "site").

## Publicar o código sem derrubar o CRM

O merge na `main` faz o Easypanel refazer o **CRM** (a rota `/api/public/lead` e o `Dockerfile.crm` mudaram). O build do CRM foi
reproduzido localmente passo a passo (instalação travada + build + servidor), mas o `docker build` em si nunca rodou. Se o build
falhar, o Easypanel mantém o contêiner antigo no ar. Acompanhe o log do `crm` logo após o merge.
