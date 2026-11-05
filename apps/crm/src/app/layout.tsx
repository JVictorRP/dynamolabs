import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Fontes do design system Dynamo Labs, servidas pelo próprio app.
const archivo = localFont({
  src: [
    { path: "../fonts/archivo.woff2", style: "normal", weight: "100 900" },
    { path: "../fonts/archivo-italic.woff2", style: "italic", weight: "100 900" },
  ],
  variable: "--font-archivo",
});
const syncopate = localFont({ src: "../fonts/syncopate-700.woff2", weight: "700", variable: "--font-syncopate" });
const oxanium = localFont({ src: "../fonts/oxanium.woff2", weight: "200 800", variable: "--font-oxanium" });

export const metadata: Metadata = {
  title: { default: "Área do cliente · Dynamo Labs", template: "%s · Dynamo Labs" },
  description: "Painel de leads, campanhas e conteúdo dos clientes Dynamo Labs.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${archivo.variable} ${syncopate.variable} ${oxanium.variable}`}>
      <body className="min-h-dvh font-sans font-light antialiased">{children}</body>
    </html>
  );
}
