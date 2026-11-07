/**
 * Estado dos textos legais (política de privacidade e termos de uso). Ficam "provisional" até o jurídico/LGPD
 * aprovar a versão final; `check:release` bloqueia a publicação enquanto não for "final".
 */
export const LEGAL = {
  status: "provisional" as "provisional" | "final",
};
