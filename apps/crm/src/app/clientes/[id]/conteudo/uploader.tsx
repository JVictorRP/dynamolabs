"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GhostButton } from "@/components/ui";

type Item = { name: string; percent: number; error?: string; done?: boolean };

/** Envia o arquivo cru por XHR (para ter a barra de progresso) à rota de arquivos. */
function upload(url: string, file: File, onProgress: (p: number) => void): Promise<{ ok: true } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onerror = () => resolve({ ok: false, error: "A conexão caiu durante o envio. Tente de novo." });
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve({ ok: true });
      let message = "Não foi possível enviar o arquivo.";
      try {
        message = (JSON.parse(xhr.responseText) as { error?: string }).error ?? message;
      } catch {}
      resolve({ ok: false, error: message });
    };
    xhr.send(file);
  });
}

const ACCEPT = "image/jpeg,image/png,image/webp,video/mp4";

/** Botão de envio com fila e progresso. `query` monta o endereço (post, capa ou foto do perfil). */
export function FileUploadButton({ label, query, multiple = false, accept = ACCEPT }: { label: string; query: string; multiple?: boolean; accept?: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  async function send(files: File[]) {
    setBusy(true);
    setItems(files.map((f) => ({ name: f.name, percent: 0 })));
    for (const [i, file] of files.entries()) {
      const r = await upload(`/api/conteudo/arquivos?${query}`, file, (percent) => setItems((all) => all.map((it, j) => (j === i ? { ...it, percent } : it))));
      setItems((all) => all.map((it, j) => (j === i ? (r.ok ? { ...it, percent: 100, done: true } : { ...it, error: r.error }) : it)));
      if (!r.ok) break; // a ordem do carrossel importa: não pula arquivos
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <input ref={input} type="file" hidden multiple={multiple} accept={accept} onChange={(e) => e.target.files?.length && send([...e.target.files])} />
      <GhostButton type="button" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "Enviando…" : label}
      </GhostButton>
      {items.length > 0 && (
        <ul className="space-y-1.5 text-xs" aria-live="polite">
          {items.map((it) => (
            <li key={it.name + it.percent}>
              <p className="truncate text-gray-300">{it.name}</p>
              {it.error ? (
                <p className="font-medium text-amber" role="alert">{it.error}</p>
              ) : (
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-graphite" role="progressbar" aria-valuenow={it.percent} aria-valuemin={0} aria-valuemax={100} aria-label={`Envio de ${it.name}`}>
                  <div className={`h-full ${it.done ? "bg-teal" : "bg-amber"}`} style={{ width: `${it.percent}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
