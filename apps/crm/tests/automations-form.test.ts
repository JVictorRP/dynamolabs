import { describe, expect, it } from "vitest";
import { automationsPatch } from "../src/lib/automations-form";

function form(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("automationsPatch", () => {
  it("turns checked boxes on and the missing ones off", () => {
    const p = automationsPatch(form({ registrar_lead: "on", enviar_n8n: "on" }));
    expect(p.actions).toEqual({ registrar_lead: true, passar_humano: false, avisar_responsavel: false, enviar_n8n: true });
  });

  it("reads the cap with a decimal comma and the hours as a number", () => {
    const p = automationsPatch(form({ monthlyCapBrl: "20,50", handoffHours: "12" }));
    expect(p.monthlyCapBrl).toBe(20.5);
    expect(p.handoffHours).toBe(12);
  });

  it("falls back to asking for text unless the policy is exactly 'humano'", () => {
    expect(automationsPatch(form({ nonTextPolicy: "humano" })).nonTextPolicy).toBe("humano");
    expect(automationsPatch(form({ nonTextPolicy: "qualquer coisa" })).nonTextPolicy).toBe("pedir_texto");
    expect(automationsPatch(form({})).nonTextPolicy).toBe("pedir_texto");
  });

  it("passes the text fields through", () => {
    const p = automationsPatch(form({ n8nWebhookUrl: "https://n8n.x/hook", ownerPhone: "5527999990000", extraRules: "Sem entrega aos domingos." }));
    expect(p).toMatchObject({ n8nWebhookUrl: "https://n8n.x/hook", ownerPhone: "5527999990000", extraRules: "Sem entrega aos domingos." });
  });
});
