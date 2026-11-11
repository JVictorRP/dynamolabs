# Chatbot de WhatsApp: `bot.dynamo.business`

Serviço que recebe as mensagens do WhatsApp (Cloud API oficial da Meta, sem intermediários), responde com o Claude e executa as automações. As telas ficam no CRM (`app.dynamo.business` → **Chatbot**).

**Ordem de deploy:** o CRM aplica as migrações do banco ao iniciar. Implante o CRM primeiro e depois o bot.

---

## 1. O que providenciar (uma vez)

### 1.1 App na Meta for Developers
1. Em <https://developers.facebook.com/apps>, clique em **Criar app**, escolha o tipo **Empresa** e ligue o app ao **Meta Business da Dynamo**.
2. No painel do app, adicione o produto **WhatsApp**.
3. Em **Configurações do app → Básico**, copie a **Chave secreta do app**. Ela é o `META_APP_SECRET`.

### 1.2 Número do bot
- Use um **número só para o bot**, sem WhatsApp ativo nele. Se o número já usa o WhatsApp, apague a conta do WhatsApp nele antes.
- Em **WhatsApp → Configuração da API**, adicione o número, confirme por SMS ou ligação e anote:
  - **Identificação do número de telefone**: o `phone_number_id`;
  - **Identificação da conta do WhatsApp Business**: o `waba_id`.

### 1.3 Token permanente (usuário do sistema)
1. Em **business.facebook.com → Configurações → Usuários → Usuários do sistema**, crie um usuário **Administrador**.
2. Em **Atribuir ativos**, dê ao usuário controle total do app e da conta do WhatsApp.
3. Em **Gerar novo token**, escolha o app, a validade **Nunca** e as permissões `whatsapp_business_messaging` e `whatsapp_business_management`.
4. Guarde o token. Ele é colado uma única vez na tela `/admin` do CRM (seção 3) e fica cifrado no banco.

### 1.4 Chave da Anthropic
Em <https://console.anthropic.com> → **API Keys**, crie uma chave. Ela é o `ANTHROPIC_API_KEY`, usada no bot e no CRM (simulador e guia de estilo). Configure um limite de gasto mensal no console também.

### 1.5 Conta de serviço do Google (planilhas)
1. Em <https://console.cloud.google.com>, crie um projeto e ative a **Google Sheets API**.
2. Em **IAM e administrador → Contas de serviço**, crie uma conta. Na aba **Chaves**, gere uma chave **JSON**.
3. O conteúdo inteiro do JSON, numa linha só, é o `GOOGLE_SERVICE_ACCOUNT_JSON`.
4. O e-mail da conta de serviço (`...@...iam.gserviceaccount.com`) é o endereço com que cada cliente compartilha a planilha, como **Leitor**.

### 1.6 Chave de cifra
Gere uma vez no terminal: `openssl rand -base64 32`. Esse valor é o `CHATBOT_ENC_KEY` e precisa ser **igual no bot e no CRM**. Não perca: sem ele, os tokens guardados não podem ser lidos e os números precisam ser ligados de novo.

## 2. DNS e Easypanel

1. **DNS na Hostinger:** registro `A`, nome `bot`, valor `168.231.100.173`, TTL 14400.
2. **Easypanel**, no mesmo projeto do CRM: crie um serviço **App** chamado `bot`.
   - **Origem:** GitHub `JVictorRP/dynamolabs`, ramo `main`.
   - **Build:** Dockerfile, arquivo `Dockerfile.bot`, caminho `/`.
   - **Domínio:** `bot.dynamo.business`, porta **3001**, HTTPS ligado.
   - **Ambiente:**

     ```
     DATABASE_URL=<a mesma do CRM>
     ANTHROPIC_API_KEY=<1.4>
     META_APP_SECRET=<1.1>
     META_VERIFY_TOKEN=<invente uma frase longa; vai também no passo 4>
     META_GRAPH_VERSION=v24.0
     CHATBOT_ENC_KEY=<1.6>
     GOOGLE_SERVICE_ACCOUNT_JSON=<1.5, numa linha>
     USD_BRL_RATE=5.50
     ```
3. **No serviço do CRM**, acrescente `CHATBOT_ENC_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON` e `USD_BRL_RATE`, com os mesmos valores, e clique em **Implantar**.
4. Confira: `https://bot.dynamo.business/health` deve responder `{"ok":true}`.

`USD_BRL_RATE` é a cotação usada para converter o custo da IA (em dólar) no teto mensal em reais. Atualize quando o dólar mudar muito.

## 3. Ligar o número a uma empresa

No CRM, abra `/admin`, vá até **Ligar WhatsApp** e informe:
- chave da Dynamo;
- slug da empresa;
- `phone_number_id`;
- `waba_id`;
- número de exibição;
- token permanente.

## 4. Inscrever o webhook na Meta

Em **WhatsApp → Configuração**, na seção **Webhook**:
- **URL de retorno:** `https://bot.dynamo.business/webhook`
- **Token de verificação:** o mesmo `META_VERIFY_TOKEN`

Clique em **Verificar e salvar**. Depois, em **Campos do webhook**, assine **messages**.

## 5. Ligar o bot

No CRM, entre como dono ou admin da empresa e abra **Chatbot**:
1. **Estilo:** suba conversas exportadas do atendente e gere o guia.
2. **Planilhas:** cole o link e escolha a aba.
3. **Automações:** ajuste as ações, o telefone do responsável e o teto mensal.
4. **Simulador:** teste as perguntas típicas.
5. **Visão geral:** só então ligue o bot.

## Observações

- **Reinícios e deploys:** ao receber o sinal de parada, o bot termina as respostas em andamento por até 20 s. No Easypanel, em **Avançado → Stop grace period** (ou equivalente), use 30 s. Se o serviço cair no meio de uma resposta, o trabalho volta para a fila sozinho em até 10 minutos, e a conversa não fica travada.

- **Avisos ao responsável** (lead quente, passagem para humano, teto atingido) são mensagens de WhatsApp enviadas pelo número do bot. A Meta só entrega mensagem livre a quem escreveu para o número nas últimas 24 h. Peça ao responsável que mande um "oi" ao número do bot de vez em quando, ou use o n8n para avisos por outro canal. Avisos que a Meta recusar não travam o atendimento.
- **Logs:** no Easypanel, serviço `bot` → **Logs**. Erros de token aparecem como "Meta respondeu 401", e o número fica "com problema" no painel. Gere um token novo (1.3) e ligue o número de novo (seção 3). Enquanto isso, as mensagens recebidas esperam na fila e são respondidas quando o número volta, desde que dentro de 24 h da última mensagem do cliente.
- **Desligar com urgência:** no CRM, em Chatbot → Visão geral, desligue o bot. As mensagens continuam gravadas e nada é respondido.
