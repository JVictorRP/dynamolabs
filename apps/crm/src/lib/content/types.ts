/** Erro de regra do conteúdo, com mensagem pronta para a tela. */
export class ContentError extends Error {}

export type ContentEventInfo = {
  organizationId: string;
  organizationName: string;
  postId: string;
  postTitle: string | null;
  type: "aprovado" | "ajuste_pedido";
  text: string | null;
  at: Date;
};

export const MAX_CAPTION = 2200;
export const MAX_COMMENT = 1000;
