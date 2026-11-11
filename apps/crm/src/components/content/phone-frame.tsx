/**
 * Moldura de celular no computador (a partir de 640 px); abaixo disso, a prévia ocupa a tela inteira.
 * O conteúdo rola dentro da "tela" e os detalhes abrem por cima dela (position absolute no computador).
 */
export function PhoneFrame({ children, overlay }: { children: React.ReactNode; overlay?: React.ReactNode }) {
  return (
    <div className="mx-auto w-full sm:max-w-[400px] sm:overflow-hidden sm:rounded-[52px] sm:border-[10px] sm:border-graphite sm:bg-black sm:shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
      <div className="relative bg-void text-mist sm:h-[800px]">
        <div className="pointer-events-none absolute left-1/2 top-2 z-30 hidden h-6 w-28 -translate-x-1/2 rounded-full bg-black sm:block" aria-hidden="true" />
        <div className="min-h-dvh sm:h-full sm:min-h-0 sm:overflow-y-auto sm:pt-10">{children}</div>
        {overlay}
      </div>
    </div>
  );
}
