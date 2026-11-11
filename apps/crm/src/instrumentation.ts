/** Roda uma vez quando o servidor do CRM sobe (só no ambiente Node). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startContentBackground } = await import("./lib/content/background");
  startContentBackground();
}
