export type LeadInput = { name: string; email: string; phone?: string; message?: string; website?: string };
export type SubmitResult = { ok: true } | { ok: false; reason: "invalid" | "network" | "rate" };

/**
 * Envia o lead ao endpoint público do CRM. Devolve um resultado que o formulário sabe tratar:
 * 200/201 → ok; 400/413 → dados inválidos; 429 → muitas tentativas; qualquer outra coisa (inclusive falha de rede) → "network".
 * O campo-isca `website` vai como veio do formulário: vazio para pessoas (que não o veem), preenchido por robôs, e o
 * servidor descarta o lead quando ele chega preenchido.
 */
export async function submitLead(input: LeadInput, endpoint: string, fetchImpl: typeof fetch = fetch): Promise<SubmitResult> {
  try {
    const res = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...input, website: input.website ?? "" }),
    });
    if (res.status === 200 || res.status === 201) return { ok: true };
    if (res.status === 400 || res.status === 413) return { ok: false, reason: "invalid" };
    if (res.status === 429) return { ok: false, reason: "rate" };
    return { ok: false, reason: "network" };
  } catch {
    return { ok: false, reason: "network" };
  }
}
