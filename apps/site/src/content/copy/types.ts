import type { Status } from "@/lib/i18n/config";

type Link = { href: string; label: string };

/** Forma do texto do site. O português é a fonte; en e es precisam ter exatamente esta forma (o `tsc` confere). */
export type Copy = {
  /** "final" só depois que o João Victor aprova o texto deste idioma. */
  status: Status;
  meta: { title: string; description: string };
  skip: string;
  langLabel: string;
  aria: { mainNav: string; footerNav: string; home: string };
  nav: { links: Link[]; cta: Link };
  hero: { eyebrow: string; support: string; title: string; keyword: string; cue: string; deco: string[] };
  s2: { eyebrow: string; title: string; keyword: string; body: string; deco: string[] };
  chat: {
    eyebrow: string;
    title: string;
    body: string;
    watermark: string;
    assistant: { name: string; status: string };
    /** `at` = progresso (0 a 1) da seção em que a mensagem chega */
    messages: { from: "user" | "bot"; at: number; time: string; text: string }[];
    cards: { label: string; detail: string; at: number }[];
  };
  video2: { eyebrow: string; title: string; keyword: string; support: string; cta: string };
  footer: { phrase: string; line: string; nav: Link[]; legal: Link[] };
  contact: {
    name: string;
    email: string;
    phone: string;
    message: string;
    submit: string;
    sending: string;
    sent: string;
    whatsapp: string;
    errors: { name: string; email: string; invalid: string; rate: string; network: string; alternative: string };
  };
};
