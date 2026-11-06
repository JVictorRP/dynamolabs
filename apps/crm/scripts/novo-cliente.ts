/**
 * Cadastra um cliente novo no CRM (rodando no computador, com acesso ao banco).
 * Em produção, prefira a rota POST /api/admin/clientes (ver docs/VPS-SETUP.md).
 *
 * Uso:
 *   pnpm novo-cliente --empresa "Bacalhau Club" --nome "Fulano" --email fulano@x.com --senha "SenhaForte123" [--demo]
 */
import { parseArgs } from "node:util";
import { createClient } from "../src/lib/onboarding";

const { values: a } = parseArgs({
  options: {
    empresa: { type: "string" },
    nome: { type: "string" },
    email: { type: "string" },
    senha: { type: "string" },
    demo: { type: "boolean", default: false },
  },
});

if (!a.empresa || !a.nome || !a.email || !a.senha) {
  console.error('Faltam dados. Ex.: --empresa "Cliente" --nome "Nome" --email a@b.com --senha "minimo10caracteres"');
  process.exit(1);
}

createClient({ empresa: a.empresa, nome: a.nome, email: a.email, senha: a.senha, demo: a.demo })
  .then((r) => {
    console.log("\n✅ Cliente criado");
    console.log(`   Empresa: ${r.organization.name} (${r.organization.id})`);
    console.log(`   Login:   ${r.login}`);
    console.log(`   Chave de API do n8n (guarde agora, não aparece de novo):\n   ${r.apiKey}\n`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
