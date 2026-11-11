"use server";

import { revalidatePath } from "next/cache";
import {
  addSheetSource,
  applyStyleGuideDraft,
  getConfig,
  importStyleExport,
  listAuthors,
  parseExport,
  releaseToBot,
  removeExample,
  removeSheetSource,
  requestStyleGuide,
  requestSync,
  resetSimulation,
  sendManualReply,
  setHumanMode,
  simulate,
  updateConfig,
} from "@dynamo/chatbot";
import { createMessageOrNull, encKey, requireManager, whatsapp } from "@/lib/chatbot";
import { db } from "@/lib/db";

export type ActionState = { ok: true; message?: string } | { ok: false; error: string } | null;

const fail = (e: unknown): ActionState => ({ ok: false, error: e instanceof Error ? e.message : "Erro inesperado." });
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function toggleBotAction(formData: FormData) {
  const { organization } = await requireManager();
  await updateConfig(db, organization.id, { enabled: formData.get("enabled") === "on" });
  revalidatePath("/chatbot");
}

/* Conversas */
export async function takeOverAction(formData: FormData) {
  const { organization } = await requireManager();
  const id = str(formData, "conversationId");
  const config = await getConfig(db, organization.id);
  await setHumanMode(db, organization.id, id, config.handoffHours);
  revalidatePath(`/chatbot/conversas/${id}`);
}

export async function releaseAction(formData: FormData) {
  const { organization } = await requireManager();
  const id = str(formData, "conversationId");
  await releaseToBot(db, organization.id, id);
  revalidatePath(`/chatbot/conversas/${id}`);
}

export async function manualReplyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organization } = await requireManager();
  const id = str(formData, "conversationId");
  try {
    await sendManualReply(db, organization.id, id, str(formData, "text"), { whatsapp, encKey: encKey() }, new Date());
    revalidatePath(`/chatbot/conversas/${id}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* Estilo */
export async function readAuthorsAction(formData: FormData): Promise<{ authors: { author: string; count: number }[] } | { error: string }> {
  await requireManager();
  try {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Escolha o arquivo exportado (.txt ou .zip)." };
    const authors = listAuthors(parseExport({ fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }));
    if (authors.length === 0) return { error: "Não encontramos mensagens neste arquivo. Ele veio de “Exportar conversa” do WhatsApp?" };
    return { authors };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Não foi possível ler o arquivo." };
  }
}

export async function importStyleAction(formData: FormData): Promise<ActionState> {
  const { organization } = await requireManager();
  try {
    const file = formData.get("file");
    if (!(file instanceof File)) return { ok: false, error: "Arquivo ausente." };
    const r = await importStyleExport(db, organization.id, { fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }, str(formData, "agent"));
    revalidatePath("/chatbot/estilo");
    return { ok: true, message: `${r.examples} exemplos importados.` };
  } catch (e) {
    return fail(e);
  }
}

export async function saveStyleGuideAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organization } = await requireManager();
  try {
    await updateConfig(db, organization.id, { styleGuide: str(formData, "styleGuide") });
    revalidatePath("/chatbot/estilo");
    return { ok: true, message: "Guia salvo." };
  } catch (e) {
    return fail(e);
  }
}

export async function requestStyleGuideAction(): Promise<ActionState> {
  const { organization } = await requireManager();
  try {
    await requestStyleGuide(db, organization.id);
    return { ok: true, message: "Gerando a proposta. Atualize a página em cerca de um minuto." };
  } catch (e) {
    return fail(e);
  }
}

export async function applyDraftAction() {
  const { organization } = await requireManager();
  await applyStyleGuideDraft(db, organization.id);
  revalidatePath("/chatbot/estilo");
}

export async function discardDraftAction() {
  const { organization } = await requireManager();
  await updateConfig(db, organization.id, { styleGuideDraft: null });
  revalidatePath("/chatbot/estilo");
}

export async function removeExampleAction(formData: FormData) {
  const { organization } = await requireManager();
  await removeExample(db, organization.id, str(formData, "exampleId"));
  revalidatePath("/chatbot/estilo");
}

/* Planilhas */
export async function addSheetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organization } = await requireManager();
  try {
    await addSheetSource(db, organization.id, { url: str(formData, "url"), tab: str(formData, "tab"), label: str(formData, "label") });
    revalidatePath("/chatbot/planilhas");
    return { ok: true, message: "Planilha adicionada. A primeira cópia leva alguns segundos." };
  } catch (e) {
    return fail(e);
  }
}

export async function syncSheetAction(formData: FormData) {
  const { organization } = await requireManager();
  await requestSync(db, organization.id, str(formData, "sourceId"));
  revalidatePath("/chatbot/planilhas");
}

export async function removeSheetAction(formData: FormData) {
  const { organization } = await requireManager();
  await removeSheetSource(db, organization.id, str(formData, "sourceId"));
  revalidatePath("/chatbot/planilhas");
}

/* Automações */
export async function saveAutomationsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organization } = await requireManager();
  try {
    await updateConfig(db, organization.id, {
      actions: {
        registrar_lead: formData.get("registrar_lead") === "on",
        passar_humano: formData.get("passar_humano") === "on",
        avisar_responsavel: formData.get("avisar_responsavel") === "on",
        enviar_n8n: formData.get("enviar_n8n") === "on",
      },
      n8nWebhookUrl: str(formData, "n8nWebhookUrl"),
      ownerPhone: str(formData, "ownerPhone"),
      nonTextPolicy: str(formData, "nonTextPolicy") === "humano" ? "humano" : "pedir_texto",
      handoffHours: Number(str(formData, "handoffHours")),
      monthlyCapBrl: Number(str(formData, "monthlyCapBrl").replace(",", ".")),
      extraRules: str(formData, "extraRules"),
    });
    revalidatePath("/chatbot/automacoes");
    return { ok: true, message: "Configurações salvas." };
  } catch (e) {
    return fail(e);
  }
}

/* Simulador */
export async function simulateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organization, user } = await requireManager();
  const createMessage = createMessageOrNull();
  if (!createMessage) return { ok: false, error: "Configure ANTHROPIC_API_KEY no CRM para usar o simulador." };
  try {
    await simulate({ db, createMessage, fetch }, organization.id, user.id, str(formData, "text"));
    revalidatePath("/chatbot/simulador");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function resetSimulationAction() {
  const { organization, user } = await requireManager();
  await resetSimulation(db, organization.id, user.id);
  revalidatePath("/chatbot/simulador");
}
