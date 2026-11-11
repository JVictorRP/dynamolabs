"use client";

import { useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";
import type { PreviewMedia } from "./preview-model";

/** Imagens do post com deslizar (toque, setas do teclado e botões), contador de pontos e proporção 4:5. */
export function MediaCarousel({ images, fileBase, label }: { images: PreviewMedia[]; fileBase: string; label: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const go = (delta: number) => track.current?.scrollBy({ left: delta * track.current.clientWidth, behavior: "smooth" });

  return (
    <div className="relative">
      <div
        ref={track}
        role="group"
        aria-roledescription="carrossel"
        aria-label={label}
        tabIndex={images.length > 1 ? 0 : -1}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            go(1);
          }
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            go(-1);
          }
        }}
        className="flex snap-x snap-mandatory overflow-x-auto bg-panel-2 outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-teal [&::-webkit-scrollbar]:hidden"
      >
        {images.map((m, i) => (
          <div key={m.id} role="group" aria-roledescription="slide" aria-label={`${i + 1} de ${images.length}`} className="aspect-[4/5] w-full shrink-0 snap-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${fileBase}/${m.fileKey}`} alt={m.alt ?? `Imagem ${i + 1} de ${images.length} do post`} className="h-full w-full select-none object-cover" draggable={false} loading={i === 0 ? "eager" : "lazy"} />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <>
          {index > 0 && (
            <button type="button" onClick={() => go(-1)} aria-label="Imagem anterior" className="absolute left-2 top-1/2 hidden size-8 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white sm:grid">
              <ChevronLeftIcon className="size-5" />
            </button>
          )}
          {index < images.length - 1 && (
            <button type="button" onClick={() => go(1)} aria-label="Próxima imagem" className="absolute right-2 top-1/2 hidden size-8 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white sm:grid">
              <ChevronRightIcon className="size-5" />
            </button>
          )}
          <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white" aria-hidden="true">
            {index + 1}/{images.length}
          </span>
          <div className="mt-3 flex justify-center gap-1.5" aria-hidden="true">
            {images.map((m, i) => (
              <i key={m.id} className={`size-1.5 rounded-full ${i === index ? "bg-teal" : "bg-graphite"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
