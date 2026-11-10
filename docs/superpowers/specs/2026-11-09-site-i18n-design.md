# Site dynamo.business em três idiomas (pt, en, es)

Status: rascunho para revisão do João Victor. Escopo: `apps/site`. Nenhuma mudança no CRM.

## Objetivo

O site passa a existir em português (padrão), inglês e espanhol, com um dropdown de idioma no menu superior. Tudo que o visitante lê é traduzido: seções, formulário e mensagens de erro, rodapé, páginas de privacidade e termos, título, descrição e prévia de compartilhamento.

## Fora de escopo

- Detectar o idioma do navegador ou redirecionar automaticamente.
- Lembrar a escolha do visitante (o site não usa cookie nem localStorage, e continua assim).
- Mudar o endpoint de leads ou o CRM (o formulário envia o mesmo payload em qualquer idioma).
- CMS, ferramenta de tradução automática em tempo de execução, idiomas da direita para a esquerda.

## Decisões

1. **Uma URL por idioma**, exportadas como páginas estáticas:

   | | Português | Inglês | Espanhol |
   |---|---|---|---|
   | Início | `/` | `/en` | `/es` |
   | Privacidade | `/privacidade` | `/en/privacy` | `/es/privacidad` |
   | Termos | `/termos` | `/en/terms` | `/es/terminos` |

   `<html lang>` é `pt-BR`, `en` e `es` conforme a página (um layout raiz por grupo de rotas). O nginx não muda: `try_files $uri $uri.html $uri/` já serve `/en` como `en.html`. Um teste confere isso.
2. **O `/` não detecta idioma.** Quem quer outro idioma usa o dropdown. Isso evita surpresa e problemas de indexação.
3. **Idiomas só são publicados quando aprovados.** Cada idioma tem `status` ("provisional" ou "final") para a copy e para os textos legais. Um idioma só é publicado (rotas, dropdown, sitemap, hreflang) com os dois em "final". Idioma provisório existe apenas no `next dev` e nos builds de teste (`NEXT_PUBLIC_E2E=1`). O português continua publicável a qualquer momento, e o `check:release` só avisa quais idiomas ficaram de fora (não é erro). Aprovar um idioma é mudar o status dele e fazer o deploy.
4. **Tom das traduções.** Inglês americano; espanhol latino-americano neutro, tratando o leitor por "tú". Nomes (Dynamo, Dynamo Labs, WhatsApp) não mudam. A voz segue a copy em português: direta, curta, em caixa-alta nos títulos. Os textos legais são tradução fiel dos aprovados em português, sem cláusula nova.

## Arquitetura

### Conteúdo

- `src/content/copy.ts` vira `src/content/copy/{pt,en,es}.ts`. O tipo `Copy` vem do português; `en` e `es` precisam satisfazê-lo, então chave faltando falha no `tsc`. Um índice exporta `COPY_BY_LANG` e a lista `LANGS`.
- Cada idioma carrega também: `meta` (título, descrição, locale do Open Graph), textos legais (privacidade e termos), rótulos do dropdown e o texto do link "Pular para o conteúdo".
- As mensagens do chat mantêm os mesmos `at` e a mesma quantidade em todos os idiomas. Hora: 24 h em pt e es, formato AM/PM em en.
- Cada título guarda `keyword`, que precisa ser uma palavra do próprio título (a palavra destacada em âmbar).

### Como os componentes recebem o texto

Nenhum componente lê um `COPY` global. As páginas (componentes de servidor) recebem o idioma da rota e o repassam: componentes de servidor (`Footer`, `LegalPage`) recebem `copy` por prop, e os de cliente (palcos, menu, formulário) leem de um `LocaleProvider` com `useCopy()` e `useLang()`. Sete componentes mudam: `SiteHeader`, `HeroStage`, `ChatSection`, `Video2Stage`, `StaticSections`, `Footer`, `ContactForm`.

### Títulos 3D e tamanhos

Os tamanhos medidos (`TITLE_SIZE_EM`) e a largura 8,92 que o CSS do hero usa (`.hero-vars` em `globals.css`) são específicos do texto em português. Passam a ser por idioma:

- `TITLE_SIZE_EM[lang]` para hero, s2 e video2.
- O CSS do hero lê `--hero-width-em`, definido inline pelo componente a partir do idioma, em vez do 8,92 fixo.
- Restrição de escrita: cada título em en/es tem o mesmo número de linhas que o português (2, 3 e 3), e a linha mais larga fica no máximo 15% acima da do português. O layout atual foi desenhado para o português e assim se mantém.

### Dropdown de idioma

- Componente `LanguageSwitcher` no menu, à direita, antes do CTA, visível em todas as larguras. Mostra o idioma atual ("PT ▾", "EN ▾", "ES ▾"), com largura fixa para não causar layout shift.
- Padrão de disclosure: um botão com `aria-expanded` abre uma lista de links (`<a href hreflang lang>`) com "Português", "English", "Español", cada um escrito no próprio idioma. O atual leva `aria-current`.
- Teclado: Enter e Espaço abrem, Esc fecha e devolve o foco ao botão, sair com Tab fecha, clique fora fecha.
- Os links levam à mesma página no outro idioma: início para início, privacidade para privacidade, termos para termos.
- Herda a cor do texto do menu (variantes clara e escura), com contraste conferido pelo axe.

### SEO

- Metadados por idioma: título, descrição, `openGraph.locale` (pt_BR, en_US, es_ES) e `alternateLocale`.
- `alternates.canonical` e `alternates.languages` (hreflang `pt-BR`, `en`, `es` e `x-default` para `/`).
- `sitemap.xml` lista todas as páginas publicadas, com as alternativas por idioma.
- O JSON-LD usa a descrição do idioma da página.

## Testes

Unitários:
- Os três idiomas têm a mesma forma: mesmas chaves, mesma quantidade de mensagens e de cartões do chat, mesmos `at`; nenhum texto vazio.
- `TITLE_SIZE_EM` confere com a fonte e a copy em cada idioma (hoje só o português), e as restrições de linhas e largura valem.
- Paridade do CSS do hero (`hero-css-parity`) nos três idiomas.
- A `keyword` de cada título existe no título (`wordIndexOf` >= 0).
- Configuração de rotas: produção só gera idiomas finais; o build de teste gera todos.
- Rotas das páginas legais e links do dropdown por página.
- `LanguageSwitcher`: abrir, fechar por Esc, foco, `aria-current`, links com `hreflang`.
- `check:release` lista os idiomas não publicados sem falhar.

E2E (os testes atuais em português continuam como estão):
- Em cada idioma: H1 traduzido, `html[lang]` correto, sem erro de console, formulário com rótulos e erros no idioma, páginas legais.
- O dropdown navega entre idiomas, em desktop e celular, com tela de 390 px sem rolagem horizontal e o título mais longo cabendo.
- axe sem violação com o menu aberto; CLS 0 na carga.
- hreflang, canonical e sitemap presentes.

Verificação de build: build de produção com os três idiomas finais mostra as rotas esperadas; com en e es provisórios mostra só as de português. Build Docker real e `curl` nas rotas novas.

## Riscos

- **Larguras dos títulos** são o ponto mais frágil; a restrição de 15% e o teste por idioma existem por isso.
- **Espaço no menu do celular:** logotipo, dropdown e CTA precisam caber em 390 px com o CTA mais longo ("Hable con nosotros" ou equivalente).
- **Tempo dos testes e2e** cresce com as rotas novas; os testes novos rodam por idioma só onde faz diferença.
- **Textos legais traduzidos** são responsabilidade do João Victor aprovar; sem aprovação o idioma não é publicado.

## Entregáveis

- Tradução completa (copy e legais) em inglês e espanhol, como provisória, para revisão em `localhost` e nas rotas `/en` e `/es` do `next dev`.
- Dropdown funcionando e testado.
- Depois da aprovação: status "final", deploy, verificação de fora (hreflang, rotas, certificado, CRM intacto).
