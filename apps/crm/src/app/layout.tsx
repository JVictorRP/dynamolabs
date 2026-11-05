import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Fontes servidas pelo próprio app (sem depender do Google Fonts).
const inter = localFont({ src: "../fonts/inter.woff2", variable: "--font-inter", weight: "100 900" });
const oxanium = localFont({ src: "../fonts/oxanium.woff2", variable: "--font-oxanium", weight: "200 800" });

export const metadata: Metadata = {
  title: { default: "Área do cliente · Dynamo", template: "%s · Dynamo" },
  description: "Painel de leads, campanhas e conteúdo dos clientes Dynamo.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${oxanium.variable}`}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
