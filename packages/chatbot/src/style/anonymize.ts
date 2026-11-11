/** Remove dados pessoais de clientes finais antes de guardar exemplos (LGPD). */
const ACCENTS: Record<string, string> = {
  a: "aáàâãä", e: "eéèêë", i: "iíìîï", o: "oóòôõö", u: "uúùûü", c: "cç", n: "nñ",
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function namePattern(name: string): string {
  return [...name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()]
    .map((ch) => (ACCENTS[ch] ? `[${ACCENTS[ch]}]` : /\s/.test(ch) ? "\\s+" : escape(ch)))
    .join("");
}

const RULES: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[EMAIL]"],
  [/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, "[CNPJ]"],
  [/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "[CPF]"],
  [/\b\d{5}-\d{3}\b/g, "[CEP]"],
  [/(?:\+?55[\s-]?)?(?:\(\d{2}\)|\b\d{2})?[\s-]?9?\d{4}[\s-]?\d{4}\b/g, "[TELEFONE]"],
];

export function anonymize(text: string, names: string[]): string {
  let out = text;
  for (const [re, label] of RULES) out = out.replace(re, (m) => (m.startsWith(" ") ? " " + label : label));

  const variants = new Set<string>();
  for (const n of names) {
    const full = n.trim();
    if (!full) continue;
    variants.add(full);
    const first = full.split(/\s+/)[0];
    if (first.length >= 3) variants.add(first);
  }
  for (const v of [...variants].sort((a, b) => b.length - a.length)) {
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${namePattern(v)}(?![\\p{L}\\p{N}])`, "giu"), "[CLIENTE]");
  }
  return out;
}
