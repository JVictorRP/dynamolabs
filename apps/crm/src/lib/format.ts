const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const int = new Intl.NumberFormat("pt-BR");
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 });

export const fmtBRL = (v: number) => brl.format(v);
export const fmtInt = (v: number) => int.format(v);
export const fmtPct = (v: number) => pct.format(v);
export const safeDiv = (a: number, b: number) => (b > 0 ? a / b : 0);

export const fmtDate = (d: Date | string | null) =>
  d ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(d)) : "—";

export const SOURCE_LABEL: Record<string, string> = {
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  site: "Site",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  indicacao: "Indicação",
  manual: "Manual",
  outro: "Outro",
};
