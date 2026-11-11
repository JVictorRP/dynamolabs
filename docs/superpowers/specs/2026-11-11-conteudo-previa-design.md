# Conteúdo e prévia para o cliente — Especificação

**Data:** 2026-11-11 · **Status:** aguardando revisão do João Victor
**Depende de:** área Clientes (`feat/crm-clientes`), que precisa estar na `main` antes do deploy desta etapa.

## 1. Objetivo

A equipe da Dynamo monta o conteúdo do Instagram de cada cliente no painel (posts, carrosséis e Reels, com arquivos, legenda e data). O cliente vê uma **prévia fiel do perfil** por um **link, sem acesso ao CRM**: o celular com a grade, e ao tocar, a prévia de cada post, carrossel e Reels, onde aprova ou pede ajuste.

**Sucesso desta etapa:** a equipe cria um post com imagem, outro carrossel e um Reels, envia para aprovação e manda o link ao cliente. O cliente abre o link no celular, vê a grade, abre cada prévia e aprova. A equipe vê a aprovação na fila e recebe o aviso. Três dias depois da aprovação o post sai do link, e a equipe ainda o tem arquivado.

## 2. Decisões tomadas

| Tema | Decisão |
|---|---|
| Arquivos | Disco do VPS, num volume do Easypanel montado em `/data`. O código usa uma interface de armazenamento, para trocar por S3 depois sem refazer as telas. |
| Link | **Um link fixo por cliente**: `app.dynamo.business/p/<código>`. Mostra a grade inteira. Gerar link novo revoga o antigo. |
| Retenção | **Três dias depois da aprovação o post sai do link do cliente.** A equipe mantém tudo arquivado (legenda, arquivos, aprovação, comentário) e pode apagar de vez, manualmente, com confirmação. |
| Aprovação | **Anônima**: o registro guarda data e hora, sem nome. |
| Aviso à equipe | Indicador e fila no painel **+** webhook opcional para o n8n **+** e-mail pelo Resend (plano grátis), reunido num e-mail a cada 10 minutos por cliente. |
| Aviso ao cliente | Não há envio automático. A equipe copia o link e uma mensagem pronta e manda como preferir (WhatsApp, e-mail). |
| Formatos | Post único, carrossel (até 10 imagens) e Reels (vídeo vertical mais capa). Stories ficam de fora. |
| Arquivos aceitos | JPG, PNG, WebP até 10 MB; vídeo MP4 (H.264) até 200 MB. Sem conversão: o MP4 chega pronto para o Instagram. |

## 3. Dados

Todas as tabelas novas têm `organization_id` (FK `organization.id`, `on delete cascade`), e toda consulta filtra por ele.

- **`content_post` (existente)**: ganha `approved_at` (timestamp) e o valor `ajuste_pedido` no enum de status (`rascunho`, `em_aprovacao`, `ajuste_pedido`, `aprovado`, `agendado`, `publicado`) e `archived_at` (timestamp). As colunas antigas `cover_url` e `media_urls` deixam de ser usadas e **não** são apagadas (sem migração destrutiva).
- **`content_media`**: `post_id`, `kind` (`image` | `video`), `position`, `file_key`, `mime`, `bytes`, `is_cover`, `alt` (texto alternativo opcional).
- **`content_profile`** (1 por empresa): `handle`, `display_name`, `avatar_file_key`, `bio`, `link`.
- **`content_share`**: `token` (24 caracteres aleatórios, único), `created_at`, `revoked_at`. Uma linha ativa por empresa.
- **`content_event`**: `post_id`, `type` (`enviado`, `aprovado`, `ajuste_pedido`, `editado`, `arquivado`, `reaberto`), `text` (comentário do cliente, quando houver), `created_at`, `handled_at` (a equipe marca como tratado).
- **`content_notice`**: fila de avisos pendentes por empresa (eventos ainda não enviados por e-mail e webhook), para juntar em um e-mail a cada 10 minutos.

### Regra de visibilidade (calculada na leitura, sem rotina agendada)

Um post aparece no link se `archived_at` é nulo **e** ou o status é `em_aprovacao` ou `ajuste_pedido`, ou o status é `aprovado`, `agendado` ou `publicado` com `approved_at` há **menos de 72 horas**. Rascunho nunca aparece. A equipe vê tudo.

## 4. Arquivos

- Ficam em `${CONTENT_DIR:-/data/content}/<organization_id>/<uuid>.<ext>`.
- **Envio:** rota própria (`POST /api/conteudo/arquivos`, só para a equipe), com fluxo contínuo para o disco, sem passar pelo limite de corpo das ações de formulário. Confere o **tipo real** (primeiros bytes), a extensão, o tamanho e recusa o resto. O nome original nunca vira caminho.
- **Entrega:** `GET /api/conteudo/arquivos/<arquivo>` para a sessão da equipe, e `GET /p/<código>/arquivo/<arquivo>` para o link. Este só entrega arquivos de posts visíveis para o código. Suporta `Range` para o player de vídeo. Cabeçalhos: `X-Content-Type-Options: nosniff`, cache privado.
- **Apagar de vez** remove as linhas e os arquivos do disco.
- Uso de disco por cliente e total é mostrado no painel.

## 5. Telas da equipe

Em **Clientes → cliente → Conteúdo** (somente `DYNAMO_STAFF_EMAILS`):

1. **Perfil do Instagram:** @usuário, nome, foto, bio e link.
2. **Posts:** grade com status e abas "Ativos" e "Arquivados". Criar e editar: formato, arrastar arquivos (ordem do carrossel e capa), legenda (contador de 2.200), título interno e data de publicação (define a posição na grade).
3. **Ações:** enviar para aprovação, marcar agendado ou publicado, arquivar, reabrir (volta para "em aprovação" e zera `approved_at`), apagar de vez.
4. **Ver como o cliente vê:** a mesma prévia do link.
5. **Link:** copiar link, copiar mensagem pronta e gerar link novo.
6. **Precisa de ação:** fila com os comentários de "ajuste pedido" e as aprovações novas; marcar como tratado. Na lista de Clientes, cada empresa mostra o indicador.
7. **Espaço usado.**

## 6. Prévia do cliente (`/p/<código>`)

Mesmo componente no link e na aba **Conteúdo** do painel do cliente logado.

- **Celular:** moldura no computador, tela cheia no celular. Cabeçalho de perfil e grade de 3 colunas, com ícones de carrossel e de Reels e etiqueta de status.
- **Post:** tela de feed com a imagem, carrossel (deslizar e pontos), legenda cortada com "mais" e a data prevista.
- **Reels:** player vertical 9:16 com play e pausa, som ligado ou desligado, e a legenda sobre o vídeo.
- **Decisão:** barra fixa com **Aprovar** e **Pedir ajuste** (comentário obrigatório no ajuste). Depois de aprovar mostra "Aprovado" e os dias que ainda faltam.
- **Estados:** grade vazia ("Nenhum post para aprovar") e página neutra, sem nenhuma informação, para link inválido ou revogado.
- Teclado, textos alternativos, controles de vídeo e 360 px.
- `noindex`, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`.

## 7. Avisos

Aprovar ou pedir ajuste grava um `content_event` e um `content_notice`.

1. **Painel:** indicador e fila (seção 5).
2. **Webhook:** se `CONTENT_NOTIFY_WEBHOOK_URL` existir, envia um POST JSON com empresa, post, tipo e comentário.
3. **E-mail:** a cada 10 minutos, um e-mail por empresa com tudo o que ficou pendente, para os endereços de `DYNAMO_NOTIFY_EMAILS`, pelo Resend (`RESEND_API_KEY`, remetente de `mail.dynamo.business`). Sem a chave ou a lista, o e-mail simplesmente não sai e o resto funciona.
- O envio e a junção rodam num temporizador do próprio CRM e sobrevivem a reinício (os avisos pendentes ficam no banco).

## 8. Segurança

- Código do link de 24 caracteres aleatórios; limite de tentativas por IP no link, na entrega de arquivos e nas ações de decisão.
- Aprovar e pedir ajuste só valem para posts que o link está mostrando naquele momento.
- Legendas e comentários são texto puro (nunca HTML).
- Envio de arquivos exige sessão da equipe; tipos e tamanhos validados no servidor.
- Link revogado ou código desconhecido: mesma resposta neutra, sem diferença que revele qual dos dois foi.

## 9. Testes

- **Visibilidade:** as bordas de 72 horas (71h59 e 72h01), `em_aprovacao`, `ajuste_pedido`, rascunho e arquivado nunca aparecem, e o código de uma empresa nunca vê dados ou arquivos de outra.
- **Arquivos:** tipo falso com extensão certa, tamanho acima do limite, nome com `../`, e `Range` do vídeo.
- **Decisão e avisos:** aprovar duas vezes é inofensivo, cada ação grava evento e aviso, e a junção dos e-mails em 10 minutos (com o Resend simulado).
- **Navegador, contra um Postgres local:** criar post, carrossel e Reels; enviar para aprovação; abrir o link sem login; ver a grade e cada prévia; aprovar; simular os 3 dias e ver o post sumir; gerar link novo e ver o antigo parar; conferir em 360 px.
- **Persistência:** um arquivo enviado continua lá depois de reiniciar o contêiner com o volume montado.

## 10. Fora desta etapa

Publicação automática no Instagram, stories, conversão de vídeo, conversa de vai e volta nos comentários (é um comentário por pedido de ajuste), o cliente editar posts, e identificação de quem aprovou.

## 11. O que o João Victor providencia

1. **Volume no Easypanel:** no serviço `crm`, montar um volume em `/data` (o passo a passo vai no `docs/VPS-SETUP.md`).
2. **Resend (grátis):** criar a conta, adicionar o domínio `mail.dynamo.business`, acrescentar os registros de DNS (SPF e DKIM) que o Resend mostrar, e gerar a chave. Variáveis: `RESEND_API_KEY` e `DYNAMO_NOTIFY_EMAILS`.
3. **Opcional:** `CONTENT_NOTIFY_WEBHOOK_URL`, a URL de um fluxo do n8n.
4. **Merge** da área Clientes (`feat/crm-clientes`) e `DYNAMO_STAFF_EMAILS` no serviço `crm`.
