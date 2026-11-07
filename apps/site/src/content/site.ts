export type Site = { whatsappUrl?: string; email?: string; instagram?: string; linkedin?: string };

const clean = (value: string | undefined): string | undefined => value?.trim() || undefined;

/** Contatos do site a partir das variáveis NEXT_PUBLIC_*; ausente ou vazio vira `undefined` (nunca string vazia). */
export function readSite(env: Record<string, string | undefined>): Site {
  return {
    whatsappUrl: clean(env.NEXT_PUBLIC_WHATSAPP_URL),
    email: clean(env.NEXT_PUBLIC_CONTACT_EMAIL),
    instagram: clean(env.NEXT_PUBLIC_INSTAGRAM_URL),
    linkedin: clean(env.NEXT_PUBLIC_LINKEDIN_URL),
  };
}

// O Next só substitui `process.env.NEXT_PUBLIC_X` quando a variável é lida pelo nome: por isso uma a uma.
export const SITE: Site = readSite({
  NEXT_PUBLIC_WHATSAPP_URL: process.env.NEXT_PUBLIC_WHATSAPP_URL,
  NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
  NEXT_PUBLIC_INSTAGRAM_URL: process.env.NEXT_PUBLIC_INSTAGRAM_URL,
  NEXT_PUBLIC_LINKEDIN_URL: process.env.NEXT_PUBLIC_LINKEDIN_URL,
});
