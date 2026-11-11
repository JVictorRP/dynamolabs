/** Modelo e funções puras da prévia (sem React, sem banco): usadas pelos componentes e testadas à parte. */
import type { ClientPost, PostWithMedia } from "@/lib/content/posts";

export { daysLeft } from "@/lib/content/rules";

export type PreviewMedia = { id: string; kind: "image" | "video"; fileKey: string; isCover: boolean; alt: string | null };
export type PreviewPost = {
  id: string;
  format: "feed" | "carrossel" | "reels" | "stories";
  status: string;
  title: string | null;
  caption: string | null;
  /** ISO 8601. */
  scheduledAt: string | null;
  approvedAt: string | null;
  daysLeft: number | null;
  media: PreviewMedia[];
};
export type PreviewProfile = { handle: string; displayName: string; avatarKey: string | null; bio: string; link: string };

export const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  em_aprovacao: "Para aprovar",
  ajuste_pedido: "Ajuste pedido",
  aprovado: "Aprovado",
  agendado: "Agendado",
  publicado: "Publicado",
};

/**
 * Serializa um post do banco para o navegador (datas em texto, mídias em ordem).
 * Para o cliente (`forClient`), o título interno nem sai do servidor: é anotação da equipe, não conteúdo do post.
 */
export function toPreviewPost(post: (PostWithMedia | ClientPost) & { daysLeft?: number | null }, opts: { forClient?: boolean } = {}): PreviewPost {
  return {
    id: post.id,
    format: post.format,
    status: post.status,
    title: opts.forClient ? null : post.title,
    caption: post.caption,
    scheduledAt: post.scheduledAt ? new Date(post.scheduledAt).toISOString() : null,
    approvedAt: post.approvedAt ? new Date(post.approvedAt).toISOString() : null,
    daysLeft: post.daysLeft ?? null,
    media: [...post.media]
      .sort((a, b) => a.position - b.position)
      .map((m) => ({ id: m.id, kind: m.kind, fileKey: m.fileKey, isCover: m.isCover, alt: m.alt })),
  };
}

/** Etiqueta curta da grade (cabe na célula sem ser cortada). O cliente vê agendado e publicado como "Aprovado". */
export function gridBadge(status: string, mode: "client" | "staff"): string {
  if (status === "ajuste_pedido") return "Ajuste";
  if (mode === "client" && (status === "agendado" || status === "publicado")) return STATUS_LABEL.aprovado;
  return STATUS_LABEL[status] ?? status;
}

const MAX_LINES = 3;

/** Legenda como no app: no máximo 3 linhas e ~125 caracteres, cortando em palavra inteira, com "mais" para o resto. */
export function truncateCaption(text: string | null | undefined, max = 125): { visible: string; truncated: boolean } {
  if (!text) return { visible: "", truncated: false };
  let visible = text;
  let truncated = false;
  const lines = visible.split("\n");
  if (lines.length > MAX_LINES) {
    visible = lines.slice(0, MAX_LINES).join("\n");
    truncated = true;
  }
  if (visible.length > max) {
    const cut = visible.slice(0, max);
    const lastBreak = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("\n"));
    visible = visible[max] === " " || visible[max] === "\n" ? cut : lastBreak > 0 ? cut.slice(0, lastBreak) : cut;
    visible = visible.trimEnd();
    truncated = true;
  }
  return { visible, truncated };
}

export function formatScheduled(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }).format(new Date(iso)).replace(/ de ([a-zç]{3})[a-zç]*$/, " de $1");
}

/** Miniatura da grade: primeira imagem, capa do Reels, ou o próprio vídeo se não houver capa. */
export function gridThumb(post: PreviewPost): { fileKey: string; isVideo: boolean; alt: string | null } | null {
  const cover = post.media.find((m) => m.isCover);
  const first = cover ?? post.media.find((m) => m.kind === "image") ?? post.media[0];
  return first ? { fileKey: first.fileKey, isVideo: first.kind === "video", alt: first.alt } : null;
}

export const carouselImages = (post: PreviewPost) => post.media.filter((m) => m.kind === "image" && !m.isCover);

export function reelsParts(post: PreviewPost): { video: PreviewMedia | null; cover: PreviewMedia | null } {
  return { video: post.media.find((m) => m.kind === "video") ?? null, cover: post.media.find((m) => m.isCover) ?? null };
}
