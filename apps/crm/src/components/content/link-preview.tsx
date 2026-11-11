"use client";

import { ContentPreview } from "./content-preview";
import type { DecideResult } from "./decision-bar";
import type { PreviewPost, PreviewProfile } from "./preview-model";

/** Prévia do link público: as decisões vão para `/p/<código>/decisao`, sem login. */
export function LinkPreview({ token, profile, posts }: { token: string; profile: PreviewProfile; posts: PreviewPost[] }) {
  async function onDecide(postId: string, decision: "aprovar" | "ajuste", comment?: string): Promise<DecideResult> {
    try {
      const res = await fetch(`/p/${token}/decisao`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postId, decision, comment }),
      });
      if (res.ok) return { ok: true };
      if (res.status === 429) return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
      if (res.status === 400) return { ok: false, error: ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Pedido inválido." };
      if (res.status === 404) return { ok: false, error: "Este post não está mais disponível. Atualize a página." };
      return { ok: false, error: "Não foi possível enviar. Tente de novo." };
    } catch {
      return { ok: false, error: "Sem conexão. Tente de novo." };
    }
  }
  return <ContentPreview mode="client" headingAs="h1" profile={profile} posts={posts} fileBase={`/p/${token}/arquivo`} onDecide={onDecide} />;
}
