import type { Legal } from "./types";

/**
 * Português: política de privacidade e termos de uso aprovados pelo João Victor ("final"). Com "provisional" a página
 * mostra o aviso de texto provisório e o idioma sai do ar.
 */
export const pt: Legal = {
  status: "final",
  back: "Voltar ao início",
  provisionalNotice: "Texto provisório: esta página será substituída pela versão aprovada antes da publicação do site.",
  privacy: {
    title: "Política de privacidade",
    metaTitle: "Política de privacidade · Dynamo",
    paragraphs: [
      "A Dynamo trata os dados que você envia pelo formulário de contato (nome, e-mail, telefone e mensagem) apenas para responder ao seu pedido.",
      "Você pode pedir a exclusão dos seus dados a qualquer momento, escrevendo para o e-mail de contato do site.",
    ],
  },
  terms: {
    title: "Termos de uso",
    metaTitle: "Termos de uso · Dynamo",
    paragraphs: [
      "Este site apresenta os serviços da Dynamo, agência de marketing digital com inteligência artificial e automação.",
      "O conteúdo é informativo e pode ser atualizado sem aviso prévio.",
    ],
  },
};
