**Dynamo | Labs** é a marca de consultoria e agência de marketing com IA e automação. A voz é direta e provocadora; o visual é tecnológico, de alto contraste, com tipografia gigante em caixa alta. Formato nativo: carrossel de Instagram 4:5, **1080 × 1350 px**.

## Fundamentos de conteúdo

- Escreva em português do Brasil, tratando o leitor por **você** ("Seu cliente não quer esperar").
- Títulos em CAIXA ALTA, curtos, em 2 a 4 linhas, com a ideia quebrada em ritmo de manchete: `SEU CLIENTE` / `NÃO QUER ESPERAR` / `ATÉ SEGUNDA` / `ÀS 8H`.
- Abra com uma tensão (pergunta, mito, dor) e feche com um convite: `FATO OU MITO?`, `OU FIQUE FORA DO JOGO.`, `E AÍ? ...VAI DEIXAR MAIS ESSA PASSAR?`, `CONHEÇA NOSSAS SOLUÇÕES DE AUTOMAÇÃO`.
- Texto de apoio: 2 a 4 linhas, frase completa, com **um** trecho em ênfase (`gera ROI`, `custo de oportunidade`, `o lead já esfriou.`) em bold itálico.
- Dados concretos ganham destaque ("aumenta em 7x a chance de conversão", "30 minutos"). Sem emojis; reticências e o ponto final dramático (`JOGO.`) são parte do tom.
- Todo título abre com uma **sobrancelha** de 2 a 5 palavras em caixa alta espaçada (`eyebrow`, tracking 0.4em): `ATENDIMENTO COM IA`, `FATO OU MITO`.
- Rodapés com mais palavras: uma frase de 5 a 10 palavras que diz o próximo passo (`DESLIZE E VEJA COMO RESPONDER SEU CLIENTE EM SEGUNDOS`, `DYNAMO LABS · MARKETING COM IA E AUTOMAÇÃO`). Palavra única (`SALVE`, `COMPARTILHE`) com tracking 0.6em (`footer-word`).
- Em carrosséis, nunca escreva `CONFIRA` nem `>>`: a navegação é a **seta para a direita** (`assets/Icons/`), no canto inferior direito de todos os slides menos o último.

## Regra absoluta: degradês só em preto e branco

NUNCA use degradê que não seja de preto e branco. Todo degradê, vinheta, névoa ou fusão de foto vai apenas de `void`/preto (ou preto transparente, `vignette-*`) para branco (ou branco transparente, `haze-white`), passando no máximo pelos cinzas que existem entre os dois (`graphite`, `gradient-end`). Proibido: degradê com teal, laranja, azul, roxo ou qualquer cor, grading colorido sobrepondo foto e transição de uma cor para outra. Cor entra só chapada: texto, ponto, fio, botão ou bloco.

## Fundamentos visuais

**Hierarquia (sempre).** Cada slide lê em quatro níveis, nesta ordem: `eyebrow` (sobrancelha espaçada, o menor texto do bloco) → linha de apoio `display-light-italic` → título pesado `display-xl`/`display-l` (o maior elemento, ≥ 3× a linha de apoio e ≥ 4× a sobrancelha) → corpo `body-light` → rodapé `footer-line`. Um único ponto focal por slide; o título é impactante, curto e em caixa alta.

**Cor da tipografia: 80 / 15 / 5.** Em cada peça, ~80% do texto em cinzas (`ink`, `ink-body`, `ink-muted`: branco, névoa, cinzas e grafite), ~15% em laranja (`highlight`/`amber`: a palavra-chave do título, um número ou a sobrancelha) e ~5% em azul (`accent`/`teal`: uma sobrancelha curta, o ponto do rodapé, o fio). Nunca título inteiro em cor; nunca laranja e azul no mesmo nível.

**Fundos escuros.** Sempre que o layout usar cor, o fundo é escuro: `surface` do tema escuro (`void`), degradê `void` → `graphite`/`gradient-end`, ou foto P&B escurecida. O tema claro (`white`) fica para slides de respiro, sem laranja ou azul em texto (teal e amber sobre branco ficam em 2.1:1 e 1.8:1).

**Fotografia.** Alterne foto **colorida** e foto **P&B** ao longo do carrossel: nunca dois slides fotográficos seguidos no mesmo tratamento. P&B: tons de cinza com contraste reforçado e `haze-white` opcional. Colorida: cores naturais levemente dessaturadas, sem filtros nem degradês coloridos por cima. Nas duas, leve vinheta e degradê em preto para drama: `vignette-edge` nas bordas e no pé, `vignette-mid` no topo, `vignette-clear` sobre o assunto. Use o banco em `assets/Banco de imagens/`.

**Capa e slides principais: foto + assunto à frente.** A capa e os slides principais (abertura de tema, virada, CTA) SEMPRE seguem o esquema `PhotoTitle`: foto de fundo, título bem diagramado, e o assunto recortado (`assets/Recortes/`, alinhado pixel a pixel à foto) por cima do título com `subject-depth`. O título ocupa a área livre da foto e não interfere no assunto: o rosto, as mãos em ação e o objeto principal (tablet, tela) ficam sempre livres; só cabelo, ombro ou contorno do corpo podem cobrir no máximo `title-overlap` (18%) do título, nunca a primeira letra nem a palavra em `highlight`. Slides de conteúdo podem usar fundo escuro liso, degradê ou foto sem recorte.

**Tipografia.** Família de exibição Archivo (substituta Google Fonts do grotesco original, ver abaixo): títulos weight 900, `letter-spacing: -0.04em`, entrelinha 0.9, caixa alta. Linha de apoio `display-light-italic` em `ink-muted`. Sobrancelhas e rodapés em Archivo com tracking largo (`eyebrow` 0.4em, `footer-line` 0.22em, `footer-word` 0.6em). Corpo `body-light` com um trecho em `body-emphasis`. Botões em Syncopate (`label-chip`). `script-accent` só em capas, uma vez por peça.

**Texto decorativo (Oxanium).** Preencha os espaços vazios do layout com uma frase curta de tecnologia, marketing ou IA, sempre como textura, nunca como informação. Padrão fixo: `deco-text` (Oxanium Light 18px, caixa alta, tracking 0.6em, entrelinha 1.7) em `deco-ink` (branco a 27%), de 1 a 5 linhas curtas, com um quadrado de `deco-bullet` (7px) antes da frase e máscara de esmaecimento abrupto para a direita (nítido no primeiro terço, some até ~66% da largura). Posição: na área livre oposta ao título (título embaixo → decorativo no topo; título no topo → ao lado ou abaixo dele, sobre parede ou fundo escuro), alinhado à `canvas-margin`, atrás do título e do assunto recortado. Nunca sobre rosto, mãos ou objeto principal; um bloco por peça. Veja `DecoText`.

**Layout e motivos.** Canvas 1080×1350, margem `canvas-margin` (100px), texto alinhado à esquerda no terço superior (o assunto ocupa o centro-baixo). Motivo assinatura: **fio teal de 1.5px com ponto** (`AccentRule`) e o ponto teal antes do rodapé. A diagonal do símbolo inspira cortes em 45°. Em carrosséis, elementos atravessam a borda entre slides.

**Raios e sombra.** `radius-md` no chip, `radius-lg` no botão. Sombras: `subject-depth` no assunto recortado e `logo-lift` no logo branco sobre branco. Degradês: só preto e branco (veja a regra absoluta no topo).

**Motion e estados.** Não definidos nas fontes: não invente. Para vídeo/reels siga a skill de edição de reels (sem tela dividida, efeitos sonoros sem repetição).

## Variação: capa laranja (tema `orange`)

Capas e slides de abertura podem inverter a distribuição de cor: o **laranja vira o fundo** e a tipografia fica preta. Aprovada na capa do reel "Physical AI" (Tractian), referência em `assets/Layouts/capa-reel-physical-ai-laranja.png`.

- **Distribuição:** ~70% da área em `amber` chapado (fundo), ~20% em `void` (título gigante e o bloco preto de apoio) e o restante na foto do assunto em cores naturais. Na tipografia: ~85% preta/grafite (`ink`, `ink-body`), sobrancelha e decorativo em `amber-ink`/`deco-ink-dark`, e `amber` só como texto DENTRO do bloco `void` (o número ou a palavra-chave, ex.: `US$ 1,4 BI`). Teal fora do texto.
- **Composição:** sobrancelha `eyebrow` em `amber-ink` (`O FUTURO É`) → título em duas camadas, a primeira em `display-xl` (`PHYSICAL`) e a segunda gigante, maior que o `display-mega` (`AI`, ~600px), ambas em `void` → assunto recortado em cor por cima da parte de baixo do título (cobre no máximo `title-overlap`, nunca a primeira letra), com `subject-depth` → bloco `void` com `radius-lg` ampliado (26px), sobrancelha em `gray-300`, frase em `white` e o dado em `amber`. Texto decorativo Oxanium em `deco-ink-dark` nos cantos de cima.
- **Luz:** só degradês preto e branco sobre o laranja chapado: `amber-glow` no centro (atrás do assunto) e `amber-shade` nas bordas. Nunca degradê laranja → outra cor.
- **Quando usar:** capas de reel e posts-manchete em que o assunto é uma foto colorida com roupa/elementos escuros ou frios (contraste com o laranja). Não use em sequência: alterne com capas no padrão escuro.

## Logo

O logo oficial é a peça principal da marca: use os arquivos de `assets/Logos/` como estão, sem redesenhar, distorcer, recolorir por CSS ou aplicar efeito. O símbolo é um "D" com recorte diagonal em 45° (a diagonal que inspira os cortes do layout); o lockup traz o símbolo sobre o wordmark `DYNAMO | LABS` em fonte extensa (EXCRATCH), centralizado.

- **Versões:** `dynamo-simbolo-*` (só o "D") e `dynamo-lockup-*` (símbolo + wordmark), cada uma em `grafite` (`graphite`, #353535) e `claro` (`mist`, névoa #e5f3f5). PNG transparente, recortado sem margem, em alta resolução.
- **Fundo:** sobre branco ou `surface` claro, `grafite`; sobre `void`, foto escura ou degradê preto, `claro`. Nunca `claro` sobre branco nem `grafite` sobre preto. As artes `dynamo-*-fundo-escuro` e `dynamo-*-fundo-claro` mostram a aplicação de referência (fundo #0f0f0f e branco).
- **Qual usar:** lockup em capas de apresentação, proposta, fechamento de carrossel, capa do LinkedIn e assinatura institucional. Símbolo sozinho no rodapé das peças (58–62px de largura no canvas), avatar, favicon e marca d'água.
- **Respiro e tamanho:** área livre mínima de `space-24` (96px no canvas) em volta do lockup e meia altura do "D" em volta do símbolo. Mínimos: símbolo 32px, lockup 160px de largura (abaixo disso o wordmark perde leitura: use só o símbolo).
- **Proibido:** contorno, sombra colorida, degradê, rotação, separar o wordmark do símbolo em outra composição, trocar a fonte do wordmark ou colocar o logo sobre área movimentada da foto (rosto, mãos, tela). A única sombra permitida é `logo-lift` (logo claro sobre branco no fechamento).
- **Fechamento de carrossel:** lockup grafite centralizado sobre branco com barra teal de 36px na borda direita, ou lockup claro sobre `void`.

Veja o componente `Logo`.

## Tipografia: fontes reais vs substitutas

As fontes originais dos layouts não vieram nos arquivos. Foram aproximadas por Google Fonts: **Archivo** (grotesco pesado e light itálico), **Syncopate** (rótulos extensos) e **Mrs Saint Delafield** (manuscrito). A **Oxanium** (arquivo em `fonts/`, licença OFL, uso comercial livre) é a fonte própria do texto decorativo. O wordmark `DYNAMO | LABS` é desenhado na fonte EXCRATCH (embutida no `.ai`), usada só no logo: não digite texto com ela. Se você tiver as licenças das fontes originais, envie os arquivos para substituirmos `type.families`.

## Iconografia

Um único ícone: a **seta para a direita** de traço fino (3px, ponta em ângulo reto), em `assets/Icons/` nas versões branca (fundo escuro/foto), grafite (fundo claro) e laranja (destaque, no máximo uma vez por carrossel). Largura `nav-arrow` (56px no canvas). Fora isso, use o motivo fio+ponto; não use emojis, `>>` nem ícones de preenchimento.

## Material de referência

`assets/Layouts/` reúne as 12 artes do carrossel "IA para PMEs" como referência de composição; `assets/Photography/` guarda os pares de exemplo (P&B e colorido) de foto + assunto recortado; `assets/Banco de imagens/` tem 19 fotos de banco e `assets/Recortes/` o recorte de cada uma, com o mesmo nome + `-recorte`. As artes antigas usam grading azul e texto ciano: isso não vale mais. Siga as regras acima, não as artes, quando divergirem.
