/** Envio de e-mail pelo Resend (API HTTP, plano grátis). Texto puro. Lança em erro, para os avisos continuarem pendentes. */
export function createResendSender(opts: { apiKey: string; from: string; fetch?: typeof fetch }) {
  const doFetch = opts.fetch ?? fetch;
  return async function send(to: string[], subject: string, text: string): Promise<void> {
    const res = await doFetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: opts.from, to, subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(`Resend respondeu ${res.status}: ${body.message ?? "sem detalhes"}`);
    }
  };
}
