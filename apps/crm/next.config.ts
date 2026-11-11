import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera um servidor enxuto para rodar em container no VPS.
  output: "standalone",
  // Código do formulário público do site (workspace), escrito em TypeScript.
  transpilePackages: ["@dynamo/public-lead", "@dynamo/db", "@dynamo/chatbot"],
  // Upload de conversas exportadas do WhatsApp (seção Chatbot).
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  // Link de prévia do cliente (/p/...): sem cache da página, sem indexar e sem enviar o endereço (que contém o código) como origem.
  async headers() {
    const safe = [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ];
    return [
      { source: "/p/:token", headers: [{ key: "Cache-Control", value: "no-store" }, ...safe] },
      { source: "/p/:token/:path*", headers: safe },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
