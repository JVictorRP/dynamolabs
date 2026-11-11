# Dynamo Business

Site institucional e área do cliente da Dynamo, no domínio **dynamo.business**.

| Endereço | O que é | Pasta |
|---|---|---|
| `dynamo.business` | Site e portfólio da agência | `apps/site` |
| `app.dynamo.business` | Área do cliente: leads, funil, campanhas e conteúdo | `apps/crm` |
| `bot.dynamo.business` | Chatbot de WhatsApp (webhook da Meta + worker); telas no CRM, seção Chatbot | `apps/bot` |
| `n8n.dynamo.business` | Automações que alimentam o CRM | *(já está rodando no VPS)* |

Pacotes compartilhados: `packages/db` (esquema do banco, usado pelo CRM e pelo bot) e `packages/chatbot` (núcleo do bot: Claude, estilo de fala, planilhas, ferramentas e fila).

## Documentação

- [Arquitetura e decisões](docs/ARQUITETURA.md)
- [Escopo do MVP do CRM](docs/MVP-CRM.md)
- [Como o n8n envia dados para o CRM](docs/N8N-INTEGRACAO.md)
- [Colocar no ar no VPS](docs/VPS-SETUP.md)
- [Deploy do chatbot de WhatsApp](deploy/bot/README.md)
- [Especificação do chatbot](docs/superpowers/specs/2026-11-10-whatsapp-chatbot-design.md)

## Rodar no computador (desenvolvimento)

Requisitos: Node 22+, pnpm e um Postgres local.

```bash
pnpm install
cp .env.example apps/crm/.env.local   # ajuste DATABASE_URL para o Postgres local
pnpm db:migrate
pnpm --filter crm novo-cliente --empresa "Cliente Demo" --nome "Teste" --email teste@dynamo.business --senha "SenhaForte123" --demo
pnpm dev:crm                           # abre em http://localhost:3000
```

Chatbot: `pnpm test:bot` roda os testes do banco, do núcleo e do serviço (sem chamar Meta, Anthropic nem Google). `pnpm dev:bot` sobe o serviço localmente; as variáveis estão em [deploy/bot/README.md](deploy/bot/README.md).

## Tecnologia

Next.js 16 · Postgres · Drizzle ORM · Better Auth (multiempresa) · Tailwind 4 · Claude (Anthropic) · WhatsApp Cloud API · deploy pelo Easypanel no VPS.
