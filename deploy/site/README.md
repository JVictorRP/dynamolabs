# Publicar o site (dynamo.business) no VPS

O site é estático: o build gera `apps/site/out` e o nginx o serve atrás do Traefik que já atende o n8n e o CRM.
Os arquivos deste pacote **não alteram** o `docker-compose.yml` do CRM: o site entra por um arquivo de extensão.

## Antes de subir

1. **Trava de lançamento:** `pnpm --filter site check:release` precisa passar. Ele bloqueia enquanto:
   - `COPY.status` (src/content/copy.ts) for `provisional`;
   - `LEGAL.status` (src/content/legal.ts) for `provisional` (política de privacidade e termos de uso);
   - faltar `NEXT_PUBLIC_LEAD_ENDPOINT` (https) ou `NEXT_PUBLIC_WHATSAPP_URL`.

   O `Dockerfile.site` roda a mesma checagem: com pendências o build da imagem falha de propósito.
2. **Endpoint de leads:** ligar `packages/public-lead` ao CRM (ver o README do pacote) e definir no `.env` do CRM
   `PUBLIC_LEAD_ORGANIZATION_ID` e `PUBLIC_LEAD_ALLOWED_ORIGINS=https://dynamo.business,https://www.dynamo.business`.
3. **DNS** (já descrito em `docs/VPS-SETUP.md`): registro A de `@` e CNAME de `www` apontando para o VPS.

## Variáveis no `.env` do VPS (além das do CRM)

```
SITE_DOMAIN=dynamo.business
NEXT_PUBLIC_LEAD_ENDPOINT=https://app.dynamo.business/api/public/lead
NEXT_PUBLIC_WHATSAPP_URL=https://wa.me/55DDDNUMERO
NEXT_PUBLIC_CONTACT_EMAIL=
NEXT_PUBLIC_INSTAGRAM_URL=
NEXT_PUBLIC_LINKEDIN_URL=
```

As três últimas são opcionais. `TRAEFIK_NETWORK` e `TRAEFIK_CERTRESOLVER` são os mesmos do CRM.

## Subir ou atualizar

```bash
cd /opt/dynamo && git pull
docker compose -f docker-compose.yml -f deploy/site/docker-compose.site.yml up -d --build site
```

As variáveis `NEXT_PUBLIC_*` entram no JavaScript **no momento do build**: mudou uma, rode o comando de novo.

## Conferir

```bash
curl -sI https://dynamo.business/ | head -5                    # 200, cache-control: no-cache
curl -sI https://dynamo.business/frames/v1/desktop/0001.webp   # cache-control: ... immutable
curl -sI https://www.dynamo.business/ | head -3                # 301 para https://dynamo.business/
```
