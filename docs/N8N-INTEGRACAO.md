# Integração n8n → CRM

Cada cliente tem uma **chave de API** própria (começa com `dyn_`), gerada ao cadastrar o cliente. A chave define para qual empresa o dado vai — não é preciso mandar o ID da empresa.

No n8n, use um nó **HTTP Request**:

- Method: `POST`
- Header: `Authorization: Bearer dyn_xxxxx` (guarde a chave em *Credentials → Header Auth*)
- Body: JSON

## 1. Enviar leads — `POST https://app.dynamo.business/api/v1/leads`

Um lead por vez ou até 500 em `{ "leads": [...] }`.

```json
{
  "name": "Ana Souza",
  "email": "ana@email.com",
  "phone": "27999990000",
  "source": "meta_ads",
  "externalId": "{{ $json.leadgen_id }}",
  "campaignName": "Leads | Novembro",
  "adsetName": "Público quente",
  "adName": "Vídeo 01",
  "formName": "Formulário Black Friday",
  "fields": { "interesse": "Mesa para 4" }
}
```

- `source`: `meta_ads`, `google_ads`, `site`, `whatsapp`, `instagram`, `indicacao`, `manual` ou `outro`.
- `externalId`: **sempre envie** o ID do lead na plataforma. Se o n8n mandar o mesmo lead duas vezes, ele é ignorado.
- Resposta: `201 { "received": 1, "inserted": 1 }`.

Fluxo sugerido (Meta): *Facebook Lead Ads Trigger* → *Set* (mapear campos) → *HTTP Request*.

## 2. Enviar resultados de campanha — `POST https://app.dynamo.business/api/v1/campaign-metrics`

Rodar 1x por dia (*Schedule Trigger*), mandando os últimos 3 dias para corrigir atrasos de atribuição. Reenviar o mesmo dia **substitui** os números.

```json
{
  "metrics": [
    {
      "platform": "meta",
      "campaignId": "120210000000000",
      "campaignName": "Leads | Novembro",
      "day": "2026-11-05",
      "impressions": 5000,
      "reach": 3800,
      "clicks": 120,
      "spend": 70.5,
      "leads": 6,
      "conversions": 0
    }
  ]
}
```

Fluxo sugerido (Meta): *Schedule* → *HTTP Request* para a Graph API `/{ad_account_id}/insights?level=campaign&time_increment=1&date_preset=last_3d&fields=campaign_id,campaign_name,impressions,reach,clicks,spend,actions` → *Code* (somar `actions` do tipo `lead`) → *HTTP Request* para o CRM.

## Erros

| Código | Significado |
|---|---|
| 401 | Chave ausente, errada ou revogada |
| 400 | JSON inválido — a resposta traz `details` com o campo problemático |
