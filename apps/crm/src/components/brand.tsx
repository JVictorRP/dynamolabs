/** Elementos de marca do design system Dynamo Labs. */

/** Assinatura em texto até recebermos o arquivo oficial do logo (assets/Logos). */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`label text-[0.78rem] text-mist ${className}`}>
      Dynamo <span className="text-gray-500">|</span> Labs
    </span>
  );
}

/** Motivo assinatura: fio teal de 1.5px terminado em ponto. */
export function AccentRule({ className = "" }: { className?: string }) {
  return (
    <div className={`relative h-[11px] ${className}`} aria-hidden="true">
      <i className="absolute inset-x-0 top-1/2 h-[1.5px] -translate-y-1/2 bg-teal" />
      <b className="absolute right-0 top-0 size-[11px] rounded-full bg-teal" />
    </div>
  );
}

/** Texto decorativo Oxanium para áreas vazias. Um bloco por tela. */
export function DecoText({ lines, className = "" }: { lines: string[]; className?: string }) {
  return (
    <div className={`deco ${className}`} aria-hidden="true">
      <span />
      <p>
        {lines.map((l, i) => (
          <span key={i} className="block">
            {l}
          </span>
        ))}
      </p>
    </div>
  );
}

/** Rodapé de frase com o ponto teal. */
export function FooterLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="footer-line flex items-center gap-3">
      <i className="size-[7px] shrink-0 rounded-full bg-teal" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/** Seta de navegação da marca (traço fino, ponta em ângulo reto). */
export function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 72 32" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" className={className} aria-hidden="true">
      <path d="M2 16H68M54 3L68 16L54 29" />
    </svg>
  );
}
