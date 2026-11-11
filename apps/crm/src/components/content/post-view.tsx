"use client";

import { useState } from "react";
import { MediaCarousel } from "./carousel";
import { BookmarkIcon, CommentIcon, HeartIcon, SendIcon } from "./icons";
import { carouselImages, formatScheduled, truncateCaption, type PreviewPost, type PreviewProfile } from "./preview-model";

export function ProfileAvatar({ profile, fileBase, size = 32 }: { profile: PreviewProfile; fileBase: string; size?: number }) {
  const initial = (profile.handle || profile.displayName || "?").replace(/^@/, "").charAt(0).toUpperCase();
  return profile.avatarKey ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`${fileBase}/${profile.avatarKey}`} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-full bg-graphite font-bold text-mist" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
      {initial}
    </span>
  );
}

export const handleOf = (profile: PreviewProfile) => (profile.handle ? profile.handle.replace(/^@/, "") : profile.displayName || "perfil");

/** Legenda como no app: primeiras linhas, "mais" para abrir o resto. */
export function Caption({ handle, text, className = "" }: { handle: string; text: string | null; className?: string }) {
  const [open, setOpen] = useState(false);
  const { visible, truncated } = truncateCaption(text);
  const shown = open ? (text ?? "") : visible;
  if (!shown) return null;
  return (
    <p className={`whitespace-pre-line break-words text-sm leading-snug ${className}`}>
      <strong className="mr-1.5 font-semibold">{handle}</strong>
      {shown}
      {truncated && !open && (
        <>
          …{" "}
          <button type="button" onClick={() => setOpen(true)} className="font-medium text-gray-300 underline decoration-graphite underline-offset-2 hover:text-white">
            mais
          </button>
        </>
      )}
    </p>
  );
}

/** Tela de um post de feed ou carrossel, como aparece no Instagram. */
export function PostView({ post, profile, fileBase }: { post: PreviewPost; profile: PreviewProfile; fileBase: string }) {
  const images = carouselImages(post);
  const handle = handleOf(profile);
  const when = formatScheduled(post.scheduledAt);
  return (
    <article className="pb-6">
      <header className="flex items-center gap-3 px-3 py-2.5">
        <ProfileAvatar profile={profile} fileBase={fileBase} />
        <p className="text-sm font-semibold">{handle}</p>
      </header>
      {images.length > 0 ? (
        <MediaCarousel images={images} fileBase={fileBase} label={post.format === "carrossel" ? "Imagens do carrossel" : "Imagem do post"} />
      ) : (
        <div className="grid aspect-[4/5] place-items-center bg-panel-2 px-6 text-center text-sm text-gray-300">Este post ainda não tem imagem.</div>
      )}
      <div className="flex items-center gap-4 px-3 pt-3 text-mist" aria-hidden="true">
        <HeartIcon className="size-6" />
        <CommentIcon className="size-6" />
        <SendIcon className="size-6" />
        <BookmarkIcon className="ml-auto size-6" />
      </div>
      <div className="space-y-2 px-3 pt-3">
        <Caption handle={handle} text={post.caption} />
        {when && <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-gray-300">Previsto para {when}</p>}
      </div>
    </article>
  );
}
