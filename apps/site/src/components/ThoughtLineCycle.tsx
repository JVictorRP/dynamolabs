"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import ThoughtLine from "./ui/ThoughtLine";

/**
 * Linha de "pensamento" decorativa (React Bits, ThoughtLine) que alterna as frases do hero.
 * É textura, não informação: escondida das tecnologias assistivas e parada na primeira frase com "reduzir movimento".
 */
export function ThoughtLineCycle({ phrases, intervalMs = 2800, fontSize = 15, className = "" }: { phrases: readonly string[]; intervalMs?: number; fontSize?: number; className?: string }) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduced || phrases.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % phrases.length), intervalMs);
    return () => clearInterval(id);
  }, [reduced, phrases.length, intervalMs]);

  if (phrases.length === 0) return null;
  return (
    <div aria-hidden="true" className={`pointer-events-none select-none font-display ${className}`}>
      <ThoughtLine label={phrases[index % phrases.length]} collapsible={false} showTimer={false} fontSize={fontSize} color="rgba(255,255,255,0.78)" glyphColor="#ffb339" />
    </div>
  );
}
