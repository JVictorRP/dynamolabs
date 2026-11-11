import "server-only";
import { createRateLimiter } from "../rate-limit";
import { LINK_LIMITS } from "./limits";

/** Limites por IP em memória (uma instância do CRM): páginas, arquivos e decisões têm faixas separadas. */
const make = (max: number) => createRateLimiter({ windowMs: LINK_LIMITS.windowMs, max, now: Date.now });
export const pageLimiter = make(LINK_LIMITS.pages);
export const fileLimiter = make(LINK_LIMITS.files);
export const decisionLimiter = make(LINK_LIMITS.decisions);
