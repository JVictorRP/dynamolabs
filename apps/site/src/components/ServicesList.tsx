import type { CSSProperties } from "react";

type Service = { name: string; text: string };

/**
 * Lista simples dos serviços na seção 2, no lugar do texto antigo: só os nomes, numerados. Sem estado e sem JavaScript
 * próprio (renderiza no servidor). A descrição de cada serviço fica na lista da versão estática e para leitores de tela.
 */
export function ServicesList({ label, services, style, fontSize = 18 }: { label: string; services: readonly Service[]; style?: CSSProperties; fontSize?: number }) {
  return (
    <ul data-services aria-label={label} className="absolute m-0 flex list-none flex-col p-0 font-display font-light text-white" style={{ ...style, gap: Math.round(fontSize * 0.35), fontSize, lineHeight: 1.25 }}>
      {services.map((s, i) => (
        <li key={s.name} className="flex items-baseline gap-3" title={s.text}>
          <span aria-hidden="true" className="font-label text-[0.6em] font-bold tracking-[0.2em] text-amber tabular-nums">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span>{s.name}</span>
        </li>
      ))}
    </ul>
  );
}
