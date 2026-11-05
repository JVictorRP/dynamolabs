# MVP do CRM — o que o cliente vê

## Telas

| Tela | O que mostra | Status |
|---|---|---|
| **Login** | E-mail e senha criados pela Dynamo | ✅ pronto |
| **Visão geral** | Leads no período, investimento, custo por lead, campanhas ativas, funil e leads por origem; filtro 7/30/90 dias | ✅ pronto |
| **Leads e funil** | Colunas por etapa (Novo lead → Em contato → Qualificado → Proposta → Ganho/Perdido), com origem, campanha e contato; mover lead de etapa | ✅ pronto |
| **Campanhas** | Investimento, impressões, CTR, leads e CPL por campanha (Meta e Google) | ✅ pronto |
| **Conteúdo** | Prévia da grade do Instagram (3 colunas, 4:5), status de cada post, legenda e botões **Aprovar / Pedir ajuste** | ✅ pronto |

## Como os dados chegam

| Dado | Origem | Caminho |
|---|---|---|
| Leads | Meta Lead Ads, Google Ads, formulários | n8n → `POST /api/v1/leads` |
| Métricas de campanha | Meta Ads Insights, Google Ads | n8n (diário) → `POST /api/v1/campaign-metrics` |
| Posts da grade | Equipe Dynamo | Fase 3 (painel interno). Até lá, via script/banco |

## Fora do MVP (próximas versões)

- Conversas de WhatsApp dentro do painel
- Painel interno da Dynamo (cadastrar cliente, subir posts, gerar chaves) sem terminal
- Recuperação de senha por e-mail e convites
- Arrastar e soltar no funil, filtros e busca de leads, exportar CSV
- Logo e cores por cliente
