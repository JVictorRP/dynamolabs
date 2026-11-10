import type { NextConfig } from "next";
// Imports relativos e só de dados: o Next carrega este arquivo sem o alias "@/".
import { en as enCopy } from "./src/content/copy/en";
import { es as esCopy } from "./src/content/copy/es";
import { en as enLegal } from "./src/content/legal/en";
import { es as esLegal } from "./src/content/legal/es";
import { hasExtraLanguages, showAllLanguages } from "./src/lib/i18n/config";

// Rotas de laboratório (src/app/lab/*/page.lab.tsx): só para os testes e2e e para o `next dev`. Em produção a extensão
// "lab.tsx" não é página, então /lab/* nem é gerado (antes saía como páginas vazias, públicas).
const withLab = process.env.NEXT_PUBLIC_E2E === "1" || process.env.NODE_ENV === "development";

// Rotas de idioma (src/app/[lang]/**/*.i18n.tsx): só existem quando há idioma além do português aprovado (ou no dev e no
// e2e). Sem isso o export estático falha por rota dinâmica sem nenhum caminho, e /en e /es nem devem existir.
const withLangs = hasExtraLanguages(
  {
    pt: { copy: "final", legal: "final" }, // o padrão sempre é publicável
    en: { copy: enCopy.status, legal: enLegal.status },
    es: { copy: esCopy.status, legal: esLegal.status },
  },
  showAllLanguages(),
);

const nextConfig: NextConfig = {
  // Vários layouts raiz (um por idioma) não têm um layout único para o 404: usa app/global-not-found.tsx.
  experimental: { globalNotFound: true },
  pageExtensions: ["tsx", "ts", ...(withLab ? ["lab.tsx"] : []), ...(withLangs ? ["i18n.tsx"] : [])],
  // Site estático: o servidor só entrega arquivos (nginx atrás do Traefik).
  output: "export",
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default nextConfig;
