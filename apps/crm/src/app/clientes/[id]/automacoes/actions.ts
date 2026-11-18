"use server";

import { revalidatePath } from "next/cache";
import { updateConfig } from "@dynamo/chatbot";
import { getClient } from "@/lib/accounts";
import { automationsPatch } from "@/lib/automations-form";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/staff";

export type AutomationsState = { ok: true; message: string } | { ok: false; error: string } | null;

/** Só a equipe da Dynamo salva; a empresa vem do formulário e é conferida no banco. */
export async function saveClientAutomationsAction(_prev: AutomationsState, formData: FormData): Promise<AutomationsState> {
  await requireStaff();
  const organizationId = String(formData.get("organizationId") ?? "");
  try {
    if (!(await getClient(db, organizationId))) return { ok: false, error: "Cliente não encontrado." };
    await updateConfig(db, organizationId, automationsPatch(formData));
    revalidatePath(`/clientes/${organizationId}/automacoes`);
    return { ok: true, message: "Configurações salvas." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado." };
  }
}
