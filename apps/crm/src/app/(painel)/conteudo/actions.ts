"use server";

import { revalidatePath } from "next/cache";
import { getOrgContext } from "@/lib/context";
import { setPostFeedback } from "@/lib/data/content";

export async function reviewPostAction(formData: FormData) {
  const { organization } = await getOrgContext();
  const decision = formData.get("decision") === "aprovar" ? "aprovado" : "rascunho";
  const feedback = String(formData.get("feedback") ?? "").trim() || null;
  await setPostFeedback(organization.id, String(formData.get("postId")), decision, feedback);
  revalidatePath("/conteudo");
}
