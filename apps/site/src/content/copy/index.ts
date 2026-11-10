import type { Lang } from "@/lib/i18n/config";
import { en } from "./en";
import { es } from "./es";
import { pt } from "./pt";
import type { Copy } from "./types";

export type { Copy } from "./types";

export const COPY_BY_LANG: Record<Lang, Copy> = { pt, en, es };

export function getCopy(lang: Lang): Copy {
  return COPY_BY_LANG[lang];
}
