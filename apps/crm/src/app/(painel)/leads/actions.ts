"use server";

import { revalidatePath } from "next/cache";
import { getOrgContext } from "@/lib/context";
import { moveLead } from "@/lib/data/leads";

export type MoveResult = { ok: true } | { ok: false; error: string };

/** Move um lead de etapa (arrastar no quadro ou escolher no seletor). Nunca lança: o quadro desfaz a mudança se vier erro. */
export async function moveLeadStageAction(leadId: string, stageId: string): Promise<MoveResult> {
  try {
    const { organization, user } = await getOrgContext();
    await moveLead(organization.id, String(leadId), String(stageId), user.id);
    revalidatePath("/leads");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Não foi possível mover o lead." };
  }
}
