/**
 * Textos do site. `status: "final"` desde a aprovação do João Victor (volte a "provisional" para bloquear a publicação):
 * `pnpm --filter site check:release` falha enquanto não for "final".
 */
export const COPY = {
  status: "final" as "provisional" | "final",
  nav: {
    links: [
      { href: "#chatbot", label: "Chatbot" },
      { href: "#contato", label: "Contato" },
    ],
    cta: { href: "#contato", label: "Fale conosco" },
  },
  hero: {
    eyebrow: "MARKETING COM IA E AUTOMAÇÃO",
    support: "a agência que pensa rápido",
    title: "SUA MARCA\nEM MOVIMENTO",
    keyword: "MOVIMENTO",
    cue: "ROLE PARA EXPLORAR",
    deco: ["AUTOMAÇÃO SEM PAUSA", "CRIATIVO EM ESCALA"],
  },
  s2: {
    eyebrow: "TRÁFEGO, CRIATIVO E SISTEMAS",
    title: "IA FAZ\nO TRABALHO\nPESADO",
    keyword: "PESADO",
    body: "Estratégia humana, execução acelerada por inteligência artificial.",
    deco: ["DADOS, NÃO PALPITES"],
  },
  chat: {
    eyebrow: "ATENDIMENTO COM IA",
    title: "RESPOSTA EM\nSEGUNDOS, DIA\nE NOITE",
    body: "Seu cliente escreve às 22h. O assistente responde, qualifica e agenda, sem fila e sem espera.",
    watermark: "24H",
    assistant: { name: "Assistente Dynamo", status: "online agora" },
    // `at` = progresso (0–1) da seção em que a mensagem chega
    messages: [
      { from: "user" as const, at: 0.28, time: "22:14", text: "Oi! Vocês têm horário na quinta?" },
      { from: "bot" as const, at: 0.4, time: "22:14", text: "Oi, tudo bem? Aqui é o assistente da Dynamo. Temos quinta às 10h e às 15h. Qual prefere?" },
      { from: "user" as const, at: 0.54, time: "22:15", text: "15h, por favor." },
      { from: "bot" as const, at: 0.66, time: "22:15", text: "Agendado! Quinta, às 15h. Envio a confirmação por aqui." },
      { from: "user" as const, at: 0.8, time: "22:16", text: "Perfeito, valeu!" },
    ],
    cards: [
      { label: "NOVO LEAD", detail: "Cliente, 22:14", at: 0.28 },
      { label: "AGENDADO", detail: "Quinta, 15h", at: 0.66 },
    ],
  },
  video2: {
    eyebrow: "A MENSAGEM CHEGOU",
    title: "SEU PRÓXIMO\nCLIENTE JÁ\nCHEGOU",
    keyword: "CHEGOU",
    support: "Quem responde primeiro, fecha. A Dynamo coloca a resposta no ar em segundos.",
    cta: "FALE COM A DYNAMO",
  },
  footer: {
    phrase: "VAMOS\nCONVERSAR?",
    line: "DYNAMO LABS · MARKETING COM IA E AUTOMAÇÃO",
    nav: [
      { href: "#chatbot", label: "Chatbot" },
      { href: "#top", label: "Início" },
    ],
    legal: [
      { href: "/privacidade", label: "Política de privacidade" },
      { href: "/termos", label: "Termos de uso" },
    ],
  },
  contact: {
    name: "Nome",
    email: "E-mail",
    phone: "WhatsApp ou telefone (opcional)",
    message: "Como podemos ajudar? (opcional)",
    submit: "Enviar",
    sending: "Enviando…",
    sent: "Recebemos sua mensagem. Respondemos em breve.",
    whatsapp: "WhatsApp",
    errors: {
      name: "Diga seu nome.",
      email: "Confira o e-mail digitado.",
      invalid: "Confira os dados e tente de novo.",
      rate: "Muitas tentativas. Aguarde alguns minutos.",
      network: "Não foi possível enviar agora. Tente de novo em instantes.",
      alternative: "Se preferir, fale pelo",
    },
  },
};
