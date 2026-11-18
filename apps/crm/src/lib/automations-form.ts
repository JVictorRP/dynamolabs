import type { BotConfigInput } from "@dynamo/chatbot";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

/** Lê o formulário de automações e monta o que será salvo na configuração do bot. */
export function automationsPatch(fd: FormData): BotConfigInput {
  return {
    actions: {
      registrar_lead: fd.get("registrar_lead") === "on",
      passar_humano: fd.get("passar_humano") === "on",
      avisar_responsavel: fd.get("avisar_responsavel") === "on",
      enviar_n8n: fd.get("enviar_n8n") === "on",
    },
    n8nWebhookUrl: str(fd, "n8nWebhookUrl"),
    ownerPhone: str(fd, "ownerPhone"),
    nonTextPolicy: str(fd, "nonTextPolicy") === "humano" ? "humano" : "pedir_texto",
    handoffHours: Number(str(fd, "handoffHours")),
    monthlyCapBrl: Number(str(fd, "monthlyCapBrl").replace(",", ".")),
    extraRules: str(fd, "extraRules"),
  };
}
