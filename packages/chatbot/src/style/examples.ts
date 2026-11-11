import type { ChatLine } from "./parse-export";

export type ExamplePair = { customerText: string; agentText: string };

/** Pares "fala do cliente → resposta do atendente", unindo mensagens seguidas do mesmo lado. */
export function extractExamples(lines: ChatLine[], agent: string): ExamplePair[] {
  const turns: { agent: boolean; text: string }[] = [];
  for (const l of lines) {
    const isAgent = l.author === agent;
    const last = turns[turns.length - 1];
    if (last && last.agent === isAgent) last.text += "\n" + l.text;
    else turns.push({ agent: isAgent, text: l.text });
  }
  const seen = new Set<string>();
  const pairs: ExamplePair[] = [];
  for (let i = 0; i + 1 < turns.length; i++) {
    if (turns[i].agent || !turns[i + 1].agent) continue;
    const pair = { customerText: turns[i].text, agentText: turns[i + 1].text };
    if (pair.agentText.length < 2 || pair.agentText.length > 1000) continue;
    const key = pair.customerText + "\u0000" + pair.agentText;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push(pair);
  }
  return pairs;
}
