import "server-only";
import { createRateLimiter } from "../rate-limit";

/** Limites por IP em memória: 300 requisições de página e arquivos e 20 decisões a cada 10 minutos. */
const WINDOW_MS = 10 * 60_000;
export const fileLimiter = createRateLimiter({ windowMs: WINDOW_MS, max: 300, now: Date.now });
export const decisionLimiter = createRateLimiter({ windowMs: WINDOW_MS, max: 20, now: Date.now });
