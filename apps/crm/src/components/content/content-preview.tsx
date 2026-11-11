"use client";

import { useEffect, useRef, useState } from "react";
import { clientLabel, DecisionBar, type DecideResult } from "./decision-bar";
import { CarouselIcon, ChevronLeftIcon, ReelsIcon } from "./icons";
import { PhoneFrame } from "./phone-frame";
import { PostView, ProfileAvatar, handleOf } from "./post-view";
import { gridThumb, STATUS_LABEL, type PreviewPost, type PreviewProfile } from "./preview-model";
import { ReelsView } from "./reels-view";

type Mode = "client" | "staff";
type Decision = "aprovar" | "ajuste";

const BADGE: Record<string, string> = {
  em_aprovacao: "bg-amber text-graphite",
  ajuste_pedido: "bg-void/80 text-amber ring-1 ring-amber/60",
  aprovado: "bg-teal text-graphite",
  agendado: "bg-teal text-graphite",
  publicado: "bg-teal text-graphite",
  rascunho: "bg-graphite text-mist",
};

/**
 * Prévia do perfil no celular: grade, post, carrossel e Reels.
 * `fileBase` é o prefixo dos endereços dos arquivos; `onDecide` só é usado no modo "client".
 */
export function ContentPreview({
  profile,
  posts,
  fileBase,
  mode,
  onDecide,
  headingAs: Heading = "h2",
}: {
  profile: PreviewProfile;
  posts: PreviewPost[];
  fileBase: string;
  mode: Mode;
  onDecide?: (postId: string, decision: Decision, comment?: string) => Promise<DecideResult>;
  /** Nível do título do perfil: "h1" quando a prévia é a página inteira (link do cliente), "h2" dentro de outra tela. */
  headingAs?: "h1" | "h2";
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, { status: string; daysLeft: number | null }>>({});
  const lastCell = useRef<HTMLElement | null>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const handle = handleOf(profile);

  const view = (p: PreviewPost): PreviewPost => ({ ...p, ...(local[p.id] ?? {}) });
  const open = openId ? posts.find((p) => p.id === openId) : undefined;
  const openPost = open ? view(open) : null;

  const close = () => {
    setOpenId(null);
    lastCell.current?.focus();
  };

  useEffect(() => {
    if (!openId) return;
    backButton.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    if (window.matchMedia("(max-width: 639px)").matches) document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [openId]);

  async function decide(postId: string, decision: Decision, comment?: string): Promise<DecideResult> {
    if (!onDecide) return { ok: false, error: "Decisão indisponível nesta tela." };
    const r = await onDecide(postId, decision, comment);
    if (r.ok) setLocal((l) => ({ ...l, [postId]: decision === "aprovar" ? { status: "aprovado", daysLeft: 3 } : { status: "ajuste_pedido", daysLeft: null } }));
    return r;
  }

  const overlay = openPost && (
    <div role="dialog" aria-modal="true" aria-label={`Prévia: ${openPost.title ?? "post"}`} className="fixed inset-0 z-40 flex flex-col bg-void sm:absolute sm:z-20 sm:pt-10">
      <div className="flex shrink-0 items-center gap-2 border-b border-graphite px-2 py-2">
        <button ref={backButton} type="button" onClick={close} className="flex items-center gap-1 rounded-[8px] px-2 py-1.5 text-sm font-medium text-mist hover:bg-graphite focus-visible:outline-2 focus-visible:outline-teal">
          <ChevronLeftIcon className="size-5" />
          Posts
        </button>
        <p className="ml-auto truncate pr-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-300">
          {openPost.format === "reels" ? "Reels" : openPost.format === "carrossel" ? "Carrossel" : "Post"}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {openPost.format === "reels" ? (
          <div className="h-full">
            <ReelsView post={openPost} profile={profile} fileBase={fileBase} />
          </div>
        ) : (
          <PostView post={openPost} profile={profile} fileBase={fileBase} />
        )}
      </div>
      {mode === "client" ? (
        <DecisionBar key={openPost.id + openPost.status} status={openPost.status} daysLeft={openPost.daysLeft} onDecide={(d, c) => decide(openPost.id, d, c)} />
      ) : (
        <div className="shrink-0 border-t border-graphite bg-panel px-4 py-3 text-xs text-gray-300">
          Visão da equipe · status: <strong className="text-mist">{STATUS_LABEL[openPost.status] ?? openPost.status}</strong>. O cliente decide pelo link.
        </div>
      )}
    </div>
  );

  return (
    <PhoneFrame overlay={overlay}>
      <header className="px-4 pb-4 pt-3">
        <div className="flex items-center gap-4">
          <ProfileAvatar profile={profile} fileBase={fileBase} size={72} />
          <div className="min-w-0">
            <Heading className="truncate text-lg font-semibold">{handle}</Heading>
            <p className="text-sm text-gray-300">
              <strong className="font-semibold text-mist">{posts.length}</strong> {posts.length === 1 ? "post" : "posts"} nesta prévia
            </p>
          </div>
        </div>
        {profile.displayName && <p className="mt-3 text-sm font-semibold">{profile.displayName}</p>}
        {profile.bio && <p className="mt-1 whitespace-pre-line break-words text-sm leading-snug">{profile.bio}</p>}
        {profile.link && (
          <p className="mt-1 truncate text-sm font-medium text-teal">{profile.link.replace(/^https?:\/\//, "")}</p>
        )}
      </header>

      {posts.length === 0 ? (
        <div className="border-t border-graphite px-6 py-16 text-center">
          <p className="display text-xl">Nenhum post para aprovar</p>
          <p className="mx-auto mt-3 max-w-xs text-sm text-gray-300">
            {mode === "client" ? "Quando a equipe enviar novos posts, eles aparecem aqui para você ver e aprovar." : "Envie posts para aprovação para vê-los aqui."}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-0.5 border-t border-graphite">
          {posts.map((raw) => {
            const p = view(raw);
            const thumb = gridThumb(p);
            const badge = mode === "client" ? clientLabel(p.status) : (STATUS_LABEL[p.status] ?? p.status);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={(e) => {
                    lastCell.current = e.currentTarget;
                    setOpenId(p.id);
                  }}
                  aria-label={`Abrir ${p.format === "reels" ? "Reels" : p.format === "carrossel" ? "carrossel" : "post"}${p.title ? `: ${p.title}` : ""}. ${badge}.`}
                  className="relative block aspect-[4/5] w-full overflow-hidden bg-panel-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal"
                >
                  {thumb ? (
                    thumb.isVideo ? (
                      <video src={`${fileBase}/${thumb.fileKey}`} muted playsInline preload="metadata" className="h-full w-full object-cover" aria-hidden="true" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`${fileBase}/${thumb.fileKey}`} alt={thumb.alt ?? ""} className="h-full w-full object-cover" loading="lazy" draggable={false} />
                    )
                  ) : (
                    <span className="grid h-full place-items-center p-2 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500">{p.title ?? "Sem imagem"}</span>
                  )}
                  <span className={`absolute left-1 top-1 max-w-[calc(100%-1.75rem)] truncate rounded-[4px] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${BADGE[p.status] ?? BADGE.rascunho}`}>{badge}</span>
                  {(p.format === "carrossel" || p.format === "reels") && (
                    <span className="absolute right-1 top-1 text-white drop-shadow" aria-hidden="true">
                      {p.format === "reels" ? <ReelsIcon className="size-5" /> : <CarouselIcon className="size-5" />}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </PhoneFrame>
  );
}
