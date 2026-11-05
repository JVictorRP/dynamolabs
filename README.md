# Dynamo Business

Site institucional e área do cliente da Dynamo, no domínio **dynamo.business**.

| Endereço | O que é | Pasta |
|---|---|---|
| `dynamo.business` | Site e portfólio da agência | `apps/site` *(próxima etapa)* |
| `app.dynamo.business` | Área do cliente: leads, funil, campanhas e conteúdo | `apps/crm` |
| `n8n.dynamo.business` | Automações que alimentam o CRM | *(já está rodando no VPS)* |

## Documentação

- [Arquitetura e decisões](docs/ARQUITETURA.md)
- [Escopo do MVP do CRM](docs/MVP-CRM.md)
- [Como o n8n envia dados para o CRM](docs/N8N-INTEGRACAO.md)
- [Colocar no ar no VPS](docs/VPS-SETUP.md)

## Rodar no computador (desenvolvimento)

Requisitos: Node 22+, pnpm e um Postgres local.

```bash
pnpm install
cp .env.example apps/crm/.env.local   # ajuste DATABASE_URL para o Postgres local
pnpm db:migrate
pnpm --filter crm novo-cliente --empresa "Cliente Demo" --nome "Teste" --email teste@dynamo.business --senha "SenhaForte123" --demo
pnpm dev:crm                           # abre em http://localhost:3000
```

## Tecnologia

Next.js 16 · Postgres 16 · Drizzle ORM · Better Auth (multiempresa) · Tailwind 4 · Docker atrás do Traefik do VPS.
