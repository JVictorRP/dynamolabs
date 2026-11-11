/** Limite de requisições por IP, em memória (uma instância do CRM). Janela fixa por endereço. */
export function createRateLimiter(opts: { windowMs: number; max: number; now: () => number; maxTracked?: number }) {
  const maxTracked = opts.maxTracked ?? 10_000;
  const seen = new Map<string, { count: number; resetAt: number }>();

  function prune(now: number) {
    for (const [ip, entry] of seen) if (entry.resetAt <= now) seen.delete(ip);
  }

  return {
    /** Registra uma requisição. Devolve false quando o endereço passou do limite (ou há endereços demais). */
    hit(ip: string): boolean {
      const now = opts.now();
      const entry = seen.get(ip);
      if (entry && entry.resetAt > now) {
        entry.count += 1;
        return entry.count <= opts.max;
      }
      if (seen.size >= maxTracked) {
        prune(now);
        if (seen.size >= maxTracked) return false; // endereços novos esperam; os já acompanhados seguem
      }
      seen.set(ip, { count: 1, resetAt: now + opts.windowMs });
      return true;
    },
  };
}

/**
 * IP de quem fez a requisição: a entrada de X-Forwarded-For que o último proxy confiável (Traefik) acrescentou,
 * contando de trás para frente. O que vem antes é controlado por quem envia e não vale como identidade.
 */
export function clientIp(headers: Headers, trustedHops = 1): string {
  const parts = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts[parts.length - trustedHops] ?? "desconhecido";
}
