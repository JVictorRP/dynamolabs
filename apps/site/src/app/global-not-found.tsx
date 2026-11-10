import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = { title: "404 | Dynamo", robots: { index: false, follow: false } };

/** 404 global: com mais de um layout raiz não existe um layout único para compor a página de erro. */
export default function GlobalNotFound() {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-void px-6 text-center text-white antialiased">
        <h1 className="m-0 text-[clamp(40px,10vw,120px)] leading-none font-black tracking-[-0.04em]">404</h1>
        <p className="m-0 text-lg text-mist">Página não encontrada. / Page not found. / Página no encontrada.</p>
        <a href="/" className="text-sm font-medium tracking-[0.22em] text-amber uppercase">
          Dynamo
        </a>
      </body>
    </html>
  );
}
