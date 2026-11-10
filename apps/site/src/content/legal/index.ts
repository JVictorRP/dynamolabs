import type { Lang } from "@/lib/i18n/config";
import { en } from "./en";
import { es } from "./es";
import { pt } from "./pt";
import type { Legal } from "./types";

export type { Legal } from "./types";

export const LEGAL_BY_LANG: Record<Lang, Legal> = { pt, en, es };

export function getLegal(lang: Lang): Legal {
  return LEGAL_BY_LANG[lang];
}
