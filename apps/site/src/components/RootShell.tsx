import { Archivo, Mrs_Saint_Delafield, Syncopate } from "next/font/google";
import localFont from "next/font/local";
import { HTML_LANG, type Lang } from "@/lib/i18n/config";
import { organizationJsonLd } from "@/lib/i18n/seo";
import "../styles/globals.css";

// Fontes do design system Dynamo Labs. Archivo, Syncopate e Mrs Saint Delafield são as
// substitutas do Google Fonts; Oxanium (OFL) é a fonte própria do texto decorativo.
const archivo = Archivo({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-archivo", display: "swap" });
const syncopate = Syncopate({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-syncopate", display: "swap" });
const saint = Mrs_Saint_Delafield({ subsets: ["latin"], weight: "400", variable: "--font-saint", display: "swap" });
const oxanium = localFont({ src: "../fonts/Oxanium-Light.ttf", weight: "300", variable: "--font-oxanium", display: "swap" });

/** Casca do documento (`<html lang>`, fontes, JSON-LD no idioma da página), compartilhada pelos layouts raiz de cada idioma. */
export function RootShell({ lang, children }: Readonly<{ lang: Lang; children: React.ReactNode }>) {
  return (
    <html lang={HTML_LANG[lang]} className={`${archivo.variable} ${syncopate.variable} ${saint.variable} ${oxanium.variable}`}>
      <body className="min-h-dvh antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd(lang)) }} />
        {children}
      </body>
    </html>
  );
}
