import type { Status } from "@/lib/i18n/config";

type LegalPageText = { title: string; metaTitle: string; paragraphs: string[] };

/** Textos das páginas legais de um idioma. Cada idioma precisa da aprovação do João Victor (status) para ir ao ar. */
export type Legal = {
  status: Status;
  back: string;
  provisionalNotice: string;
  privacy: LegalPageText;
  terms: LegalPageText;
};
