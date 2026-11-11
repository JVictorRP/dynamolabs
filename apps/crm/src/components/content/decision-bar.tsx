"use client";

import { useState } from "react";

export type DecideResult = { ok: true } | { ok: false; error: string };

const plural = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;

/** Barra fixa do post: aprovar ou pedir ajuste (comentário obrigatório). Depois de aprovado, mostra quantos dias o post ainda fica aqui. */
export function DecisionBar({
  status,
  daysLeft,
  onDecide,
}: {
  status: string;
  daysLeft: number | null;
  onDecide: (decision: "aprovar" | "ajuste", comment?: string) => Promise<DecideResult>;
}) {
  const [asking, setAsking] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(decision: "aprovar" | "ajuste") {
    setBusy(true);
    setError(null);
    const r = await onDecide(decision, decision === "ajuste" ? comment : undefined).catch(() => ({ ok: false as const, error: "Não foi possível enviar. Tente de novo." }));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setAsking(false);
    setComment("");
  }

  if (status === "aprovado" || status === "agendado" || status === "publicado") {
    return (
      <div className="border-t border-graphite bg-panel px-4 py-3 text-sm" role="status">
        <p className="font-semibold text-teal">Aprovado ✓</p>
        {daysLeft !== null && <p className="mt-0.5 text-xs text-gray-300">Este post continua aqui por mais {plural(daysLeft)}.</p>}
      </div>
    );
  }

  return (
    <div className="border-t border-graphite bg-panel px-4 py-3">
      {status === "ajuste_pedido" && !asking && <p className="mb-2 text-xs text-amber" role="status">Você pediu ajuste. A equipe vai enviar uma nova versão.</p>}
      {asking ? (
        <div className="space-y-2">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-300">O que precisa mudar?</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={1000}
              rows={3}
              autoFocus
              className="mt-1.5 w-full rounded-[8px] border border-graphite bg-panel-2 p-2.5 text-sm text-white outline-none focus:border-teal"
              placeholder="Ex.: Trocar a foto da capa por uma mais clara."
            />
          </label>
          {error && <p className="text-xs font-medium text-amber" role="alert">{error}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={busy || !comment.trim()} onClick={() => send("ajuste")} className="flex-1 rounded-[10px] bg-amber px-3 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-graphite disabled:opacity-50">
              {busy ? "Enviando…" : "Enviar pedido"}
            </button>
            <button type="button" disabled={busy} onClick={() => {
                setAsking(false);
                setError(null);
              }} className="rounded-[10px] border border-graphite px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-mist">
              Voltar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {error && <p className="text-xs font-medium text-amber" role="alert">{error}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => send("aprovar")} className="flex-1 rounded-[10px] bg-teal px-3 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-graphite disabled:opacity-60">
              {busy ? "Enviando…" : status === "ajuste_pedido" ? "Aprovar mesmo assim" : "Aprovar"}
            </button>
            <button type="button" disabled={busy} onClick={() => setAsking(true)} className="flex-1 rounded-[10px] border border-graphite px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-mist hover:border-gray-300 disabled:opacity-60">
              {status === "ajuste_pedido" ? "Pedir outro ajuste" : "Pedir ajuste"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
