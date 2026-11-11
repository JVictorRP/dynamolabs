"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Result } from "./actions";

/** Chama uma ação do servidor, mostra o erro e atualiza a página quando dá certo. */
export function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run<T extends object>(fn: () => Promise<Result<T>>, after?: (r: { ok: true } & T) => void) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) return setError(r.error);
      after?.(r);
      router.refresh();
    });
  }
  return { run, pending, error, setError };
}
