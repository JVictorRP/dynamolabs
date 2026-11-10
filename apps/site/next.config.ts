import type { NextConfig } from "next";

// Rotas de laboratório (src/app/lab/*/page.lab.tsx): só para os testes e2e e para o `next dev`. Em produção a extensão
// "lab.tsx" não é página, então /lab/* nem é gerado (antes saía como páginas vazias, públicas).
const withLab = process.env.NEXT_PUBLIC_E2E === "1" || process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // Vários layouts raiz (um por idioma) não têm um layout único para o 404: usa app/global-not-found.tsx.
  experimental: { globalNotFound: true },
  pageExtensions: withLab ? ["tsx", "ts", "lab.tsx"] : ["tsx", "ts"],
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
