export type ChatMessage = { from: "user" | "bot"; text: string; at: number };

/** Quanto do progresso o indicador "digitando" aparece antes de cada mensagem (o bot "pensa" mais que o cliente). */
const TYPING_WINDOW = { bot: 0.06, user: 0.03 } as const;

/**
 * A conversa em função do scroll: mensagens cujo `at` já passou (ordenadas) e quem está "digitando" antes da
 * próxima. Reversível: rolar para trás as tira de novo.
 */
export function visibleChat<T extends ChatMessage>(script: T[], p: number): { shown: T[]; typing: "user" | "bot" | null } {
  const shown = script.filter((m) => p >= m.at);
  const next = script.find((m) => p < m.at);
  const typing = next && p >= next.at - TYPING_WINDOW[next.from] ? next.from : null;
  return { shown, typing };
}

/** Parte do palco do chat em que a conversa corre: começa quando o texto da seção já chegou e acaba antes de o vídeo 2 cobrir a tela. */
export const CHAT_FROM = 0.04;
export const CHAT_TO = 0.92;
