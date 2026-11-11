"use client";

import { useEffect, useRef, useState } from "react";
import { MuteIcon, PauseIcon, PlayIcon, VolumeIcon } from "./icons";
import { Caption, ProfileAvatar, handleOf } from "./post-view";
import { reelsParts, type PreviewPost, type PreviewProfile } from "./preview-model";

/** Reels: vídeo vertical 9:16 com play/pausa, som e legenda sobre o vídeo. Começa mudo (os navegadores exigem). */
export function ReelsView({ post, profile, fileBase }: { post: PreviewPost; profile: PreviewProfile; fileBase: string }) {
  const { video, cover } = reelsParts(post);
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const handle = handleOf(profile);

  useEffect(() => {
    const el = ref.current;
    return () => el?.pause();
  }, []);

  if (!video) {
    return <div className="grid h-full place-items-center px-6 text-center text-sm text-gray-300">Este Reels ainda não tem vídeo.</div>;
  }
  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  return (
    <div className="relative mx-auto flex h-full max-h-full w-full items-center justify-center bg-black">
      <div className="relative aspect-[9/16] max-h-full w-full overflow-hidden bg-black">
        <video
          ref={ref}
          src={`${fileBase}/${video.fileKey}`}
          poster={cover ? `${fileBase}/${cover.fileKey}` : undefined}
          playsInline
          loop
          muted={muted}
          preload="metadata"
          aria-label={`Vídeo do Reels${post.title ? `: ${post.title}` : ""}`}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onClick={toggle}
          className="h-full w-full cursor-pointer object-cover"
        />
        {!playing && (
          <button type="button" onClick={toggle} aria-label="Reproduzir vídeo" className="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white">
            <PlayIcon className="size-8" />
          </button>
        )}
        <div className="absolute inset-x-0 top-0 flex items-center gap-2.5 bg-gradient-to-b from-black/70 to-transparent p-3 text-white">
          <ProfileAvatar profile={profile} fileBase={fileBase} size={28} />
          <p className="text-sm font-semibold">{handle}</p>
        </div>
        <div className="absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-3 pb-3 pt-14 pr-14 text-white">
          <Caption handle={handle} text={post.caption} />
        </div>
        <div className="absolute bottom-3 right-3 flex flex-col gap-2">
          {playing && (
            <button type="button" onClick={toggle} aria-label="Pausar vídeo" className="grid size-9 place-items-center rounded-full bg-black/55 text-white">
              <PauseIcon className="size-5" />
            </button>
          )}
          <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Ligar o som" : "Desligar o som"} aria-pressed={!muted} className="grid size-9 place-items-center rounded-full bg-black/55 text-white">
            {muted ? <MuteIcon className="size-5" /> : <VolumeIcon className="size-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
