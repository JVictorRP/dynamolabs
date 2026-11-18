"use client";

import { useState, useTransition } from "react";
import { moveLeadInBoard } from "@/lib/board";
import { fmtDate, SOURCE_LABEL } from "@/lib/format";
import { moveLeadStageAction, type MoveResult } from "./actions";

export type BoardStage = { id: string; name: string; isWon: boolean };
export type BoardLead = {
  id: string;
  stageId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  campaignName: string | null;
  createdAt: string;
};

/** Quadro do funil: arraste o cartão para outra coluna (ou use o seletor, que também serve no celular). */
export function LeadBoard({
  stages,
  leads: initial,
  moveAction = moveLeadStageAction,
}: {
  stages: BoardStage[];
  leads: BoardLead[];
  /** Ação que grava a mudança no servidor (injetável para testar o quadro sem banco). */
  moveAction?: (leadId: string, stageId: string) => Promise<MoveResult>;
}) {
  const [leads, setLeads] = useState(initial);
  const [seen, setSeen] = useState(initial);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Quando o servidor reenvia os leads (depois de mover ou de novos contatos), o quadro acompanha.
  if (seen !== initial) {
    setSeen(initial);
    setLeads(initial);
  }

  function move(leadId: string, stageId: string) {
    const before = leads;
    const after = moveLeadInBoard(before, leadId, stageId);
    if (after === before) return;
    setError(null);
    setLeads(after);
    startTransition(async () => {
      const r = await moveAction(leadId, stageId);
      if (!r.ok) {
        setLeads(before);
        setError(`Não consegui mover o lead: ${r.error}`);
      }
    });
  }

  return (
    <>
      <p role="status" aria-live="polite" className={error ? "text-sm font-medium text-amber" : "sr-only"}>
        {error ?? ""}
      </p>
      <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-4 md:mx-0 md:px-0">
        {stages.map((stage) => {
          const items = leads.filter((l) => l.stageId === stage.id);
          const isOver = overStage === stage.id && draggingId !== null;
          return (
            <section
              key={stage.id}
              data-stage-column={stage.id}
              className={`w-72 shrink-0 rounded-[12px] transition ${isOver ? "bg-graphite/40 ring-1 ring-teal" : ""}`}
              onDragOver={(e) => {
                if (draggingId === null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overStage !== stage.id) setOverStage(stage.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverStage((s) => (s === stage.id ? null : s));
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || draggingId;
                setOverStage(null);
                setDraggingId(null);
                if (id) move(id, stage.id);
              }}
            >
              <div className="mb-3 flex items-center justify-between border-b border-graphite pb-3">
                <h2 className="footer-line !text-mist">{stage.name}</h2>
                <span className={`text-sm font-bold tabular-nums ${stage.isWon ? "text-amber" : "text-white"}`}>{items.length}</span>
              </div>
              <ul className="min-h-24 space-y-2">
                {items.map((lead) => (
                  <li
                    key={lead.id}
                    data-lead-card={lead.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", lead.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDraggingId(lead.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setOverStage(null);
                    }}
                    className={`cursor-grab rounded-[12px] border border-graphite bg-panel p-4 active:cursor-grabbing ${draggingId === lead.id ? "opacity-40" : ""}`}
                  >
                    <p className="truncate text-sm font-bold text-white">{lead.name || lead.email || lead.phone || "Sem nome"}</p>
                    <p className="mt-1 truncate text-xs text-gray-300">{[lead.phone, lead.email].filter(Boolean).join(" · ") || "Sem contato"}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                      <span className="rounded-[4px] bg-graphite px-1.5 py-0.5 font-semibold uppercase tracking-[0.12em] text-mist">{SOURCE_LABEL[lead.source]}</span>
                      {lead.campaignName && (
                        <span className="max-w-full truncate rounded-[4px] border border-graphite px-1.5 py-0.5 text-gray-300">{lead.campaignName}</span>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-gray-500">{fmtDate(lead.createdAt)}</span>
                      <select
                        aria-label={`Mover ${lead.name || "lead"} para outra etapa`}
                        value={lead.stageId ?? ""}
                        onChange={(e) => move(lead.id, e.target.value)}
                        className="max-w-[9rem] rounded-[4px] border border-graphite bg-panel-2 px-1.5 py-1 text-[11px] text-mist"
                      >
                        {stages.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
