import type { ContentEventInfo } from "./types";

/**
 * Avisa o n8n (ou qualquer URL https) de uma decisão do cliente. Melhor esforço: nunca lança e desiste depois de
 * `timeoutMs`; quem chama não espera por isso — a decisão do cliente nunca fica presa num webhook lento.
 */
export async function notifyWebhook(url: string | undefined, info: ContentEventInfo, fetchFn: typeof fetch = fetch, timeoutMs = 5000): Promise<void> {
  if (!url || !/^https:\/\/\S+$/.test(url)) return;
  try {
    const res = await fetchFn(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: `content.${info.type}`,
        organizationId: info.organizationId,
        organizationName: info.organizationName,
        postId: info.postId,
        postTitle: info.postTitle,
        text: info.text,
        at: info.at.toISOString(),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status >= 400) console.warn(`Webhook de conteúdo respondeu ${res.status}.`);
  } catch (e) {
    console.warn("Webhook de conteúdo falhou:", (e as Error).message);
  }
}
