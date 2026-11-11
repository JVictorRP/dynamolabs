"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AccountError, addMember, resetMemberPassword } from "@/lib/accounts";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createClient } from "@/lib/onboarding";
import { requireStaff } from "@/lib/staff";

export type Credentials = { empresa?: string; nome: string; login: string; senha: string | null; apiKey?: string };
export type ClientesState = { ok: true; credentials: Credentials } | { ok: false; error: string } | null;


const fail = (e: unknown): ClientesState => {
  if (e instanceof AccountError) return { ok: false, error: e.message };
  console.error(e);
  return { ok: false, error: "Erro inesperado. Veja os logs do serviço no Easypanel." };
};

const novoCliente = z.object({
  empresa: z.string().trim().min(2, "Nome da empresa muito curto.").max(120),
  nome: z.string().trim().min(2, "Nome do contato muito curto.").max(120),
  email: z.email("E-mail inválido."),
  demo: z.boolean(),
});

export async function novoClienteAction(_prev: ClientesState, fd: FormData): Promise<ClientesState> {
  await requireStaff();
  const parsed = novoCliente.safeParse({
    empresa: fd.get("empresa"),
    nome: fd.get("nome"),
    email: String(fd.get("email") ?? "").trim(),
    demo: fd.get("demo") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    const r = await createClient(parsed.data);
    revalidatePath("/clientes");
    return { ok: true, credentials: { empresa: r.organization.name, nome: parsed.data.nome, login: r.login, senha: r.senha ?? null, apiKey: r.apiKey } };
  } catch (e) {
    return fail(e);
  }
}

const novaPessoa = z.object({
  organizationId: z.string().min(1),
  nome: z.string().trim().min(2, "Nome muito curto.").max(120),
  email: z.email("E-mail inválido."),
  papel: z.enum(["owner", "admin", "member"]),
});

export async function addMemberAction(_prev: ClientesState, fd: FormData): Promise<ClientesState> {
  await requireStaff();
  const parsed = novaPessoa.safeParse({
    organizationId: fd.get("organizationId"),
    nome: fd.get("nome"),
    email: String(fd.get("email") ?? "").trim(),
    papel: fd.get("papel"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    const { organizationId, ...input } = parsed.data;
    const r = await addMember({ db, authContext: await auth.$context }, organizationId, input);
    revalidatePath(`/clientes/${organizationId}`);
    return { ok: true, credentials: { nome: input.nome, login: r.login, senha: r.senha } };
  } catch (e) {
    return fail(e);
  }
}

export async function resetPasswordAction(_prev: ClientesState, fd: FormData): Promise<ClientesState> {
  await requireStaff();
  try {
    const organizationId = String(fd.get("organizationId") ?? "");
    const senha = await resetMemberPassword({ db, authContext: await auth.$context }, organizationId, String(fd.get("userId") ?? ""));
    return { ok: true, credentials: { nome: String(fd.get("nome") ?? ""), login: String(fd.get("email") ?? ""), senha } };
  } catch (e) {
    return fail(e);
  }
}

