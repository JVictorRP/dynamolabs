import type { Metadata } from "next";
import { Archivo, Mrs_Saint_Delafield, Syncopate } from "next/font/google";
import localFont from "next/font/local";
import { SITE } from "@/content/site";
import "../styles/globals.css";

// Fontes do design system Dynamo Labs. Archivo, Syncopate e Mrs Saint Delafield são as
// substitutas do Google Fonts; Oxanium (OFL) é a fonte própria do texto decorativo.
const archivo = Archivo({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-archivo", display: "swap" });
const syncopate = Syncopate({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-syncopate", display: "swap" });
const saint = Mrs_Saint_Delafield({ subsets: ["latin"], weight: "400", variable: "--font-saint", display: "swap" });
const oxanium = localFont({ src: "../fonts/Oxanium-Light.ttf", weight: "300", variable: "--font-oxanium", display: "swap" });

const DESCRIPTION = "Agência de marketing digital com IA e automação: tráfego pago, criativo, site e sistemas, com a qualidade e o dinamismo da inteligência artificial.";

export const metadata: Metadata = {
  metadataBase: new URL("https://dynamo.business"),
  title: { default: "Dynamo | Marketing digital com IA e automação", template: "%s" },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Dynamo",
    locale: "pt_BR",
    url: "https://dynamo.business",
    title: "Dynamo | Marketing digital com IA e automação",
    description: DESCRIPTION,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Dynamo" }],
  },
  twitter: { card: "summary_large_image", title: "Dynamo | Marketing digital com IA e automação", description: DESCRIPTION, images: ["/og.png"] },
};

const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Dynamo",
  url: "https://dynamo.business",
  logo: "https://dynamo.business/brand/dynamo-lockup-grafite.png",
  description: DESCRIPTION,
  ...(SITE.instagram || SITE.linkedin ? { sameAs: [SITE.instagram, SITE.linkedin].filter(Boolean) } : {}),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${archivo.variable} ${syncopate.variable} ${saint.variable} ${oxanium.variable}`}>
      <body className="min-h-dvh antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }} />
        {children}
      </body>
    </html>
  );
}
