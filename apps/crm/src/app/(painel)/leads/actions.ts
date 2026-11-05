"use server";

import { revalidatePath } from "next/cache";
import { getOrgContext } from "@/lib/context";
import { moveLead } from "@/lib/data/leads";

export async function moveLeadAction(formData: FormData) {
  const { organization, user } = await getOrgContext();
  await moveLead(organization.id, String(formData.get("leadId")), String(formData.get("stageId")), user.id);
  revalidatePath("/leads");
}
