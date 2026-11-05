# Colocar o CRM no ar (VPS Hostinger · KVM 2 · Ubuntu 24.04)

Tudo abaixo é feito no **Web console** do painel da Hostinger (ou `ssh root@168.231.100.173`).

> ⚠️ Não troque o sistema operacional nem aplique o template "Coolify" pelo painel: isso apaga o VPS, inclusive o n8n.

## 0. Antes de tudo: backup

Painel Hostinger → VPS → **Backups e monitoramento** → criar um snapshot. Se algo der errado, você volta em 1 clique.

## 1. Descobrir como o n8n está montado

```bash
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}"
docker network ls
grep -rn "certresolver\|acme" /root/docker-compose.yml 2>/dev/null | head
```

O que esperar (template n8n da Hostinger): um container **traefik** ocupando as portas 80/443, uma rede chamada parecida com `root_default` e um certresolver chamado `mytlschallenge`. Anote os dois nomes: eles vão para o `.env` (`TRAEFIK_NETWORK` e `TRAEFIK_CERTRESOLVER`).

## 2. DNS (painel Hostinger → Domínios → dynamo.business → DNS)

| Tipo | Nome | Aponta para |
|---|---|---|
| A | `@` | `168.231.100.173` |
| A | `app` | `168.231.100.173` |
| A | `n8n` | `168.231.100.173` *(se ainda não existir)* |
| CNAME | `www` | `dynamo.business` |

A propagação leva de minutos a algumas horas.

## 3. Firewall

```bash
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable && ufw status
```

## 4. Baixar o código

O repositório é privado, então o VPS precisa de uma chave só de leitura:

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/dynamo_deploy -C "vps-dynamo"
cat ~/.ssh/dynamo_deploy.pub
```

Copie a linha exibida e cadastre em GitHub → repositório **dynamolabs** → Settings → **Deploy keys** → *Add deploy key* (sem marcar "write access"). Depois:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github-dynamo
  HostName github.com
  IdentityFile ~/.ssh/dynamo_deploy
EOF
git clone git@github-dynamo:JVictorRP/dynamolabs.git /opt/dynamo
cd /opt/dynamo
```

## 5. Configurar e subir

```bash
cp .env.example .env
openssl rand -hex 32   # copie para BETTER_AUTH_SECRET
openssl rand -hex 24   # copie para POSTGRES_PASSWORD e dentro do DATABASE_URL
nano .env              # cole os valores e confira TRAEFIK_NETWORK / TRAEFIK_CERTRESOLVER
docker compose up -d --build
docker compose logs -f crm   # deve aparecer "Migrações aplicadas." e "Ready"
```

Abra **https://app.dynamo.business** — deve aparecer a tela de login.

## 6. Cadastrar o primeiro cliente

```bash
docker compose run --rm tools pnpm novo-cliente \
  --empresa "Bacalhau Club" --nome "Nome do contato" \
  --email contato@cliente.com --senha "UmaSenhaForte2026"
```

O comando mostra a **chave de API do n8n** uma única vez. Guarde no n8n (*Credentials → Header Auth*).

Para a sua própria conta de teste com dados fictícios, acrescente `--demo`.

## 7. Atualizar depois de mudanças no código

```bash
cd /opt/dynamo && git pull && docker compose up -d --build
```

## 8. Backups

- O serviço `backup` grava um dump diário em `/opt/dynamo/backups` (guarda 14 dias).
- Próximo passo: copiar essa pasta para fora do VPS (Google Drive via rclone ou um bucket S3).

## Se algo der errado

| Sintoma | Causa provável |
|---|---|
| `network ... not found` | `TRAEFIK_NETWORK` diferente do que aparece em `docker network ls` |
| Site abre sem cadeado / erro de certificado | DNS ainda propagando ou `TRAEFIK_CERTRESOLVER` com nome errado |
| Login dá erro "Invalid origin" | `BETTER_AUTH_URL` diferente do endereço acessado |
| `crm` reiniciando sem parar | Rode `docker compose logs crm` e verifique `DATABASE_URL` |
