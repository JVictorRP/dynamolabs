import Link from "next/link";
import { PERIODS, type Period } from "@/lib/data/period";

/**
 * Cabeçalho de página na hierarquia da marca:
 * sobrancelha → título pesado em caixa alta (uma palavra em âmbar) → linha de apoio light itálico.
 */
export function PageHeader({
  eyebrow,
  title,
  highlight,
  support,
  children,
}: {
  eyebrow: string;
  title: string;
  /** Palavra do título que vai em âmbar (os 15% de laranja). */
  highlight?: string;
  support?: string;
  children?: React.ReactNode;
}) {
  const parts = highlight ? title.split(highlight) : [title];
  return (
    <header className="flex flex-wrap items-end justify-between gap-6">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display mt-4 text-4xl md:text-6xl">
          {highlight ? (
            <>
              {parts[0]}
              <span className="text-amber">{highlight}</span>
              {parts.slice(1).join(highlight)}
            </>
          ) : (
            title
          )}
        </h1>
        {support && <p className="display-light mt-3 text-xl md:text-2xl">{support}</p>}
      </div>
      {children}
    </header>
  );
}

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <section className={`rounded-[12px] border border-graphite bg-panel p-6 ${className}`}>{children}</section>;
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow eyebrow-muted">{children}</p>;
}

/** Número em destaque. `accent` = o número-herói da tela, em âmbar (use em um só por tela). */
export function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <Card>
      <CardTitle>{label}</CardTitle>
      <p className={`display mt-5 text-4xl tabular-nums ${accent ? "text-amber" : ""}`}>{value}</p>
      {hint && <p className="mt-3 text-xs text-gray-300">{hint}</p>}
    </Card>
  );
}

export function PeriodTabs({ current, basePath }: { current: Period; basePath: string }) {
  return (
    <nav className="flex rounded-[8px] border border-graphite bg-panel p-1">
      {(Object.keys(PERIODS) as Period[]).map((p) => (
        <Link
          key={p}
          href={`${basePath}?periodo=${p}`}
          className={`footer-line rounded-[6px] px-3 py-2 ${p === current ? "bg-graphite !text-white" : "hover:!text-white"}`}
        >
          {p.replace("d", " dias")}
        </Link>
      ))}
    </nav>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[12px] border border-dashed border-graphite px-6 py-14 text-center">
      <p className="display text-2xl">{title}</p>
      <p className="mx-auto mt-4 max-w-md text-sm text-gray-300">{text}</p>
    </div>
  );
}

/** Botão CTA da marca: teal chapado, texto grafite em Syncopate. */
export function CtaButton({ className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`label rounded-[12px] bg-teal px-6 py-3.5 text-[0.7rem] text-graphite transition hover:brightness-110 disabled:opacity-60 ${className}`}
    />
  );
}

/** Botão secundário: contorno grafite. */
export function GhostButton({ className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`label rounded-[12px] border border-graphite px-6 py-3.5 text-[0.7rem] text-mist transition hover:border-gray-300 ${className}`}
    />
  );
}
