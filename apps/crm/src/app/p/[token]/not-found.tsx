/** Mesma página para código desconhecido e link revogado: nada que diga qual dos dois foi. */
export default function LinkIndisponivel() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-sm">
        <h1 className="display text-3xl">Link indisponível</h1>
        <p className="mt-4 text-gray-300">Este link não está mais ativo. Peça um link novo para a equipe que enviou.</p>
      </div>
    </main>
  );
}
