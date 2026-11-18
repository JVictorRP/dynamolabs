import type { BotIndicator } from "@dynamo/chatbot";

const LOOK: Record<BotIndicator, { text: string; dot: string; label: string; box: string }> = {
  on: { text: "ON", dot: "bg-emerald-400", label: "Chatbot ligado e respondendo", box: "text-emerald-300 border-emerald-400/40" },
  off: { text: "OFF", dot: "bg-gray-500", label: "Chatbot desligado", box: "text-gray-300 border-graphite" },
  erro: { text: "ERRO", dot: "bg-amber", label: "Chatbot ligado, mas o número de WhatsApp está com problema", box: "text-amber border-amber/50" },
};

/** Selo ao lado de "Chatbot" no menu: bolinha colorida + ON, OFF ou ERRO. */
export function BotBadge({ state }: { state: BotIndicator }) {
  const look = LOOK[state];
  return (
    <span
      data-bot-badge={state}
      title={look.label}
      role="status"
      aria-label={look.label}
      className={`inline-flex items-center gap-1.5 rounded-[4px] border px-1.5 py-0.5 text-[0.58rem] font-bold tracking-[0.16em] ${look.box}`}
    >
      <i className={`size-[6px] rounded-full ${look.dot}`} aria-hidden="true" />
      {look.text}
    </span>
  );
}
