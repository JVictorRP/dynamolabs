"use server";

import { z } from "zod";
import { adminTokenHint, checkAdminToken, configuredAdminToken } from "@/lib/admin";
import { AdminError, deleteContactData, linkNumber, setNumberStatus } from "@dynamo/chatbot";
import { AccountError, resetPasswordByEmail } from "@/lib/accounts";
import { auth } from "@/lib/auth";
import { encKey } from "@/lib/chatbot";
import { db } from "@/lib/db";
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

/** Mensagem de erro da chave da Dynamo, ou null quando confere. */
function adminTokenError(token: string): string | null {
  if (checkAdminToken(token)) return null;
  const configured = configuredAdminToken();
  if (configured.length < 32) {
    return `O app não está lendo um ADMIN_TOKEN válido (lido: ${configured.length} caracteres; precisa de 32+). Confira a variável no Easypanel e faça um novo Deploy.`;
  }
  return `Chave da Dynamo incorreta. ${adminTokenHint(token)}`;
}

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

  const tokenError = adminTokenError(parsed.data.token);
  if (tokenError) return { ok: false, error: tokenError };

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

export type AdminFormState = { ok: true; message: string } | { ok: false; error: string } | null;

const field = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function guarded(fd: FormData, run: () => Promise<string>): Promise<AdminFormState> {
  const tokenError = adminTokenError(field(fd, "token"));
  if (tokenError) return { ok: false, error: tokenError };
  try {
    return { ok: true, message: await run() };
  } catch (e) {
    if (e instanceof AdminError || e instanceof AccountError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado. Veja os logs do serviço no Easypanel." };
  }
}

export async function ligarWhatsappAction(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  return guarded(fd, async () => {
    await linkNumber(
      db,
      {
        organizationSlug: field(fd, "slug"),
        phoneNumberId: field(fd, "phoneNumberId"),
        wabaId: field(fd, "wabaId"),
        displayPhone: field(fd, "displayPhone"),
        accessToken: field(fd, "accessToken"),
      },
      encKey(),
    );
    return "Número ligado. Agora inscreva o webhook na Meta (deploy/bot/README.md, passo 4).";
  });
}

export async function statusWhatsappAction(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  return guarded(fd, async () => {
    const status = field(fd, "status") === "desligado" ? "desligado" : "ativo";
    await setNumberStatus(db, field(fd, "phoneNumberId"), status);
    return status === "desligado" ? "Número desligado: o bot ignora as mensagens dele." : "Número reativado.";
  });
}

export async function excluirTitularAction(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  return guarded(fd, async () => {
    const r = await deleteContactData(db, field(fd, "slug"), field(fd, "phone"));
    return `Apagadas ${r.conversations} conversa(s) e ${r.messages} mensagem(ns) desse telefone. O lead no CRM, se houver, continua.`;
  });
}

export async function resetarSenhaAction(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  return guarded(fd, async () => {
    const r = await resetPasswordByEmail({ db, authContext: await auth.$context }, field(fd, "email"));
    return `Senha nova de ${r.login}: ${r.senha} — aparece só agora; as sessões abertas foram encerradas.`;
  });
}
