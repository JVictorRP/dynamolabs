"use server";

import { decide } from "@/lib/content/decisions";
import { onContentEvent } from "@/lib/content/hooks";
import { ContentError } from "@/lib/content/types";
import { getOrgContext } from "@/lib/context";
import { db } from "@/lib/db";

/** Aprovar ou pedir ajuste pelo painel: a empresa vem da sessão, nunca do navegador. */
export async function decideAction(postId: string, decision: "aprovar" | "ajuste", comment?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { organization } = await getOrgContext();
  try {
    const result = await decide(db, { now: () => new Date(), onEvent: onContentEvent }, { organizationId: organization.id, postId, decision, comment });
    if (result === "indisponivel") return { ok: false, error: "Este post não está mais disponível. Atualize a página." };
    return { ok: true };
  } catch (e) {
    if (e instanceof ContentError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Não foi possível enviar. Tente de novo." };
  }
}
