import Link from "next/link";
import { PERIODS, type Period } from "@/lib/data/period";

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 font-display text-2xl font-semibold md:text-3xl">{title}</h1>
      </div>
      {children}
    </header>
  );
}

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <section className={`rounded-xl border border-ink-800 bg-ink-900 p-5 ${className}`}>{children}</section>;
}

export function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <Card>
      <p className="eyebrow">{label}</p>
      <p className={`mt-3 font-display text-3xl font-semibold tabular-nums ${accent ? "text-dyn-orange" : "text-ink-100"}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </Card>
  );
}

export function PeriodTabs({ current, basePath }: { current: Period; basePath: string }) {
  return (
    <nav className="flex rounded-lg border border-ink-800 bg-ink-900 p-1 text-xs">
      {(Object.keys(PERIODS) as Period[]).map((p) => (
        <Link
          key={p}
          href={`${basePath}?periodo=${p}`}
          className={`rounded-md px-3 py-1.5 ${p === current ? "bg-ink-700 text-ink-100" : "text-ink-400 hover:text-ink-100"}`}
        >
          {p.replace("d", " dias")}
        </Link>
      ))}
    </nav>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-ink-700 p-10 text-center">
      <p className="font-display text-lg text-ink-300">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">{text}</p>
    </div>
  );
}
