"use server";

import { z } from "zod";
import { checkAdminToken } from "@/lib/admin";
import { createClient, OnboardingError } from "@/lib/onboarding";

export type NovoClienteState =
  | { ok: true; empresa: string; login: string; apiKey: string }
  | { ok: false; error: string }
  | null;

const schema = z.object({
  token: z.string().min(1, "Informe a chave da Dynamo."),
  empresa: z.string().trim().min(2, "Nome da empresa muito curto."),
  nome: z.string().trim().min(2, "Nome do contato muito curto."),
  email: z.email("E-mail inválido."),
  senha: z.string().min(10, "A senha precisa ter pelo menos 10 caracteres."),
  demo: z.boolean(),
});

export async function novoClienteAction(_prev: NovoClienteState, formData: FormData): Promise<NovoClienteState> {
  const parsed = schema.safeParse({
    token: String(formData.get("token") ?? ""),
    empresa: formData.get("empresa"),
    nome: formData.get("nome"),
    email: String(formData.get("email") ?? "").trim(),
    senha: formData.get("senha"),
    demo: formData.get("demo") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  if (!checkAdminToken(parsed.data.token)) {
    if (!process.env.ADMIN_TOKEN || process.env.ADMIN_TOKEN.trim().length < 32) {
      return { ok: false, error: "ADMIN_TOKEN não está configurado no Easypanel (precisa ter 32+ caracteres)." };
    }
    return { ok: false, error: "Chave da Dynamo incorreta." };
  }

  try {
    const { token: _t, ...input } = parsed.data;
    void _t;
    const r = await createClient(input);
    return { ok: true, empresa: r.organization.name, login: r.login, apiKey: r.apiKey };
  } catch (e) {
    if (e instanceof OnboardingError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Erro inesperado ao cadastrar. Veja os logs do serviço no Easypanel." };
  }
}
