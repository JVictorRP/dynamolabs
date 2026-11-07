/**
 * Pendências que bloqueiam a publicação do site. Lista vazia = pronto.
 * `copyStatus` vem de `src/content/copy.ts`; `legalStatus`, de `src/content/legal.ts` (padrão "final").
 */
export function checkRelease(env: Record<string, string | undefined>, copyStatus: string, legalStatus: string = "final"): string[] {
  const problems: string[] = [];
  const value = (name: string) => env[name]?.trim() || "";

  if (copyStatus !== "final") problems.push('A copy ainda é provisória: aprove os textos e mude COPY.status para "final" em src/content/copy.ts.');
  if (legalStatus !== "final") problems.push('A política de privacidade e os termos de uso ainda são provisórios: coloque o texto aprovado e mude LEGAL.status para "final" em src/content/legal.ts.');

  const endpoint = value("NEXT_PUBLIC_LEAD_ENDPOINT");
  if (!endpoint) problems.push("Defina NEXT_PUBLIC_LEAD_ENDPOINT (URL do endpoint público de leads do CRM).");
  else if (!endpoint.startsWith("https://")) problems.push("NEXT_PUBLIC_LEAD_ENDPOINT deve usar https: o formulário envia dados pessoais.");

  if (!value("NEXT_PUBLIC_WHATSAPP_URL")) problems.push("Defina NEXT_PUBLIC_WHATSAPP_URL (link do WhatsApp da Dynamo, a alternativa do formulário).");
  return problems;
}
