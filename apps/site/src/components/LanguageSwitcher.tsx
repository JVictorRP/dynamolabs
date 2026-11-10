"use client";

import { useEffect, useId, useRef, useState } from "react";
import { HTML_LANG, pathFor, type Lang } from "@/lib/i18n/config";
import { useCopy, useLang, usePageKey } from "./LocaleProvider";

/** Cada idioma escrito no próprio idioma. */
const NAME: Record<Lang, string> = { pt: "Português", en: "English", es: "Español" };

/**
 * Seletor de idioma do menu (padrão "disclosure": um botão abre uma lista de links). Os links ficam sempre no HTML
 * (escondidos enquanto fechado), então buscadores e quem está sem JavaScript os enxergam. Cada link leva à MESMA página
 * no outro idioma (início para início, privacidade para privacidade).
 */
export function LanguageSwitcher({ languages }: { languages: readonly Lang[] }) {
  const lang = useLang();
  const page = usePageKey();
  const copy = useCopy();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  // Clique fora fecha.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  if (languages.length < 2) return null;

  return (
    <div
      ref={rootRef}
      data-language-switcher
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
      onBlur={(e) => {
        // Tab para fora do seletor fecha; mover o foco entre o botão e os links não.
        if (open && !rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-[4.25rem] items-center justify-center gap-1.5 rounded-lg font-label text-[0.65rem] font-bold tracking-[0.2em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      >
        {/* O nome acessível começa pelo texto visível ("PT") e acrescenta o rótulo só para leitor de tela (WCAG 2.5.3). */}
        <span>{lang.toUpperCase()}</span>
        <span className="sr-only"> ({copy.langLabel})</span>
        <svg aria-hidden="true" width="10" height="6" viewBox="0 0 10 6" fill="none" className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <ul
        id={listId}
        hidden={!open}
        className="absolute top-full right-0 z-10 mt-2 m-0 min-w-40 list-none rounded-lg border border-graphite bg-void p-1.5 text-white shadow-lg"
      >
        {languages.map((l) => (
          <li key={l}>
            <a
              href={pathFor(l, page)}
              hrefLang={HTML_LANG[l]}
              lang={HTML_LANG[l]}
              aria-current={l === lang ? "true" : undefined}
              className={`flex min-h-11 items-center rounded-md px-3 font-display text-sm font-medium hover:bg-graphite focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white ${l === lang ? "text-amber" : ""}`}
            >
              {NAME[l]}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
