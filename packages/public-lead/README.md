# @dynamo/public-lead

Tratador do `POST /api/public/lead`: recebe o formulário do site (dynamo.business) e grava o lead no CRM
(`app.dynamo.business`). É código puro, com tudo injetado, e por isso é testado aqui sem banco nem Next.

## Proteções
- **CORS:** só as origens em `allowedOrigins` (o site). Sem `Origin` ou origem desconhecida → 403.
- **Campo-isca** `website`: se vier preenchido, responde 200 e não cria nada.
- **Limite de taxa:** 5 envios por IP em 10 minutos (o 6º recebe 429 com `Retry-After`).
- **Duplo clique:** mesmo IP + e-mail em 10 s conta como um envio.
- **Validação:** nome 1–120, e-mail válido, telefone ≤ 40, mensagem ≤ 2000, corpo ≤ 10.000 caracteres.
- `externalId` = sha256(`e-mail|dia`), para o `onConflictDoNothing` do `ingestLeads` deduplicar no mesmo dia.
- Falha do CRM → 500 com mensagem genérica (sem detalhes internos).

## Como ligar no CRM (apps/crm)

1. Em `apps/crm/package.json`, dependência `"@dynamo/public-lead": "workspace:*"`; em `apps/crm/next.config.ts`,
   `transpilePackages: ["@dynamo/public-lead"]`.
2. Criar `apps/crm/src/app/api/public/lead/route.ts`:

```ts
import { createPublicLeadHandler } from "@dynamo/public-lead";
import { ingestLeads } from "@/lib/data/leads";

const handle = createPublicLeadHandler({
  ingest: ingestLeads,
  now: () => Date.now(),
  allowedOrigins: (process.env.PUBLIC_LEAD_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  organizationId: process.env.PUBLIC_LEAD_ORGANIZATION_ID ?? "",
});

export const POST = handle;
export const OPTIONS = handle;
```

3. Variáveis no `.env` do CRM:
   - `PUBLIC_LEAD_ORGANIZATION_ID` — id da organização Dynamo no CRM;
   - `PUBLIC_LEAD_ALLOWED_ORIGINS` — `https://dynamo.business,https://www.dynamo.business`.
4. No site: `NEXT_PUBLIC_LEAD_ENDPOINT=https://app.dynamo.business/api/public/lead`.

> Não testado contra o CRM real (o código-fonte do CRM não estava acessível quando isto foi escrito). Confira o
> tipo de `ingestLeads` (`IncomingLead`) ao colar: aqui usamos só `name`, `email`, `phone`, `source: "site"`,
> `externalId`, `formName` e `fields`.
