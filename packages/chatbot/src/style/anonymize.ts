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
  [
    /\b(?:[Rr]ua|R\.|[Aa]v\.?|[Aa]venida|[Tt]ravessa|Tv\.|[Aa]lameda|Al\.|[Rr]odovia|[Ee]strada|[Pp]ra[çc]a|[Ll]argo)\s+[^,\n\d]{2,60}?,?\s*(?:n[ºo°]?\.?\s*)?\d+[A-Za-z]?\b/g,
    "[ENDERECO]",
  ],
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

const NOT_NAMES = new Set(
  "tudo sim não nao pessoal gente todos todas senhor senhora amigo amiga querido querida bem claro pode que como aqui ok obrigado obrigada dona cliente moça moço vizinho vizinha".split(" "),
);
const INTRO = /(?:\bsou\s+(?:o|a)|\bmeu\s+nome\s+é|\bme\s+chamo|\baqui\s+é(?:\s+(?:o|a))?)\s+([\p{L}]{3,}(?:\s+\p{Lu}[\p{L}]{2,})?)/giu;
const GREETING =
  /(?:^|[\s,.!])(?:[Oo]i|[Oo]l[áa]|[Bb]om\s+dia|[Bb]oa\s+tarde|[Bb]oa\s+noite|[Oo]brigad[oa]|[Vv]aleu|[Tt]chau|[Pp]erfeito|[Cc]laro)[,!\s]+(\p{Lu}\p{Ll}{2,})(?![\p{L}])/gu;

/**
 * Nomes de clientes que aparecem no texto quando o contato não estava salvo (o autor é um telefone):
 * apresentações ("sou a Maria Souza", "meu nome é joão") e saudações do atendente ("Boa tarde, Maria!").
 */
export function discoverNames(lines: { text: string }[]): string[] {
  const found = new Set<string>();
  for (const { text } of lines) {
    for (const m of text.matchAll(INTRO)) {
      const words = m[1].split(/\s+/).filter((w) => !NOT_NAMES.has(w.toLowerCase()));
      if (words.length > 0) found.add(words.join(" "));
    }
    for (const m of text.matchAll(GREETING)) if (!NOT_NAMES.has(m[1].toLowerCase())) found.add(m[1]);
  }
  // "Maria" é coberto por "Maria Souza" (o anonimizador já mascara o primeiro nome).
  return [...found].filter((n) => ![...found].some((o) => o !== n && o.split(/\s+/)[0].toLowerCase() === n.toLowerCase()));
}
