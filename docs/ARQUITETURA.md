# Arquitetura — Dynamo Business

## Visão geral

```
                    ┌──────────────── VPS Hostinger KVM 2 (8 GB · 100 GB) ────────────────┐
 Internet ──HTTPS──▶│  Traefik (já existente, gera SSL automático)                        │
                    │     ├── dynamo.business       → site (Next.js, estático)            │
                    │     ├── app.dynamo.business   → CRM (Next.js) ──▶ Postgres 16       │
                    │     └── n8n.dynamo.business   → n8n ──(API com chave)──▶ CRM        │
                    │  Backup diário do Postgres → ./backups (+ cópia fora do VPS)       │
                    └─────────────────────────────────────────────────────────────────────┘
       Meta Ads / Google Ads ──▶ n8n ──▶ POST /api/v1/leads e /api/v1/campaign-metrics
```

## Decisões

| Tema | Decisão | Por quê |
|---|---|---|
| CRM | Construído do zero (caminho 1) | É o produto vendido; precisa ter a cara e as regras da Dynamo |
| Multiempresa | Um único sistema; toda tabela tem `organization_id` | Um deploy atende todos os clientes; isolamento testado |
| Login | Better Auth, e-mail e senha, **sem cadastro público** | Só a Dynamo cria acessos; papéis owner/admin/member por empresa |
| Banco | Postgres 16 no próprio VPS (rede interna, sem porta exposta) | Custo zero e dados no Brasil sob seu controle |
| Entrada de dados | n8n → API do CRM com chave por cliente | Reaproveita o n8n; o CRM não precisa falar com Meta/Google direto no MVP |
| Deploy | Docker Compose atrás do Traefik do n8n | Não arrisca o n8n; Coolify fica como opção futura |
| Subdomínios | site e app separados | Site rápido e indexável; app privado (`noindex`) |

## Entraves e como estamos tratando

1. **Isolamento entre clientes.** Toda leitura/escrita passa por `src/lib/data/*` com a empresa já validada pela sessão ou pela chave de API. Testado: um segundo cliente não vê dados do primeiro.
2. **LGPD.** A Dynamo é *operadora* dos dados dos leads dos clientes. Pendências: cláusula de tratamento de dados no contrato, política de privacidade e termos de uso no site, procedimento de exclusão de dados a pedido.
3. **WhatsApp por cliente (fase futura).** Cada cliente precisa do próprio número na API oficial. Para conectar pelo painel, a Dynamo precisará do programa *Tech Provider* da Meta — processo lento, vale iniciar cedo.
4. **E-mail transacional.** Hoje os acessos são criados pela Dynamo com senha. Para "esqueci minha senha" e convites, contratar Resend ou Brevo e configurar SPF/DKIM/DMARC no domínio.
5. **Ponto único de falha.** Tudo em um VPS. Backup diário local já incluso; falta copiar os backups para fora (Google Drive/S3) e ativar o backup semanal do painel Hostinger.
6. **Capacidade.** 8 GB de RAM atendem site + CRM + n8n com folga no início. Reavaliar com ~20 clientes ativos ou se o n8n passar a rodar fluxos pesados.

## Roteiro

- **Fase 0 — Fundação (hoje):** repositório, CRM com login multiempresa, leads/funil, campanhas, grade de conteúdo, API para o n8n.
- **Fase 1 — No ar:** DNS dos subdomínios, deploy no VPS, primeiro cliente real (Bacalhau Club), fluxo n8n de leads da Meta.
- **Fase 2 — Site:** portfólio com o design system da Dynamo, cases, captação de leads (que entram no próprio CRM da Dynamo).
- **Fase 3 — Painel Dynamo:** tela interna para cadastrar clientes, subir conteúdos e gerar chaves de API sem terminal.
- **Fase 4 — Crescimento:** e-mail transacional, Google Ads via n8n, alertas de lead novo, WhatsApp.
