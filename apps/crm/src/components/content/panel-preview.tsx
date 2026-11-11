"use client";

import { decideAction } from "@/app/(painel)/conteudo/actions";
import { ContentPreview } from "./content-preview";
import type { PreviewPost, PreviewProfile } from "./preview-model";

/** A mesma prévia do link, dentro do painel do cliente logado (decisão pela empresa da sessão). */
export function PanelPreview({ profile, posts }: { profile: PreviewProfile; posts: PreviewPost[] }) {
  return <ContentPreview mode="client" profile={profile} posts={posts} fileBase="/api/conteudo/arquivos" onDecide={decideAction} />;
}
