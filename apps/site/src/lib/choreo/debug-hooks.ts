const handlers = new Set<(hidden: boolean) => void>();

/**
 * Registra uma função que esconde/mostra o texto de um palco. O gancho único `window.__dynamo.debug.hideText`
 * (usado pelos testes e2e para medir o fundo sem o texto) chama todas as registradas. Devolve a limpeza.
 */
export function registerHideText(handler: (hidden: boolean) => void): () => void {
  handlers.add(handler);
  const dyn = (window.__dynamo ??= { progress: {}, history: [] });
  dyn.debug = { hideText: (hidden) => handlers.forEach((h) => h(hidden)) };
  return () => void handlers.delete(handler);
}
