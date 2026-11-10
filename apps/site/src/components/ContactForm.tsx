"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { SITE } from "@/content/site";
import { submitLead } from "@/lib/contact/submit-lead";
import { useCopy } from "./LocaleProvider";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string; offerWhatsapp: boolean };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fieldClass = "w-full rounded-lg bg-graphite px-4 py-3 font-display text-base font-light text-white placeholder:text-gray-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal";
const labelClass = "mb-2 block font-display text-[0.7rem] font-semibold tracking-[0.22em] text-gray-300 uppercase";

/** Formulário de contato: grava o lead no CRM pelo endpoint público; WhatsApp como alternativa quando configurado. */
export function ContactForm({
  endpoint = process.env.NEXT_PUBLIC_LEAD_ENDPOINT,
  fetchImpl,
  whatsappUrl = SITE.whatsappUrl,
}: {
  endpoint?: string;
  fetchImpl?: typeof fetch;
  whatsappUrl?: string;
}) {
  const copy = useCopy();
  const errors = copy.contact.errors;
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // Antes de o JavaScript hidratar (ou sem ele), o <form> sem `action` enviaria por GET, pondo nome, e-mail e telefone na
  // URL, no histórico e nos logs do servidor, sem nada chegar ao CRM. Por isso ele só aparece depois de hidratado.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const sending = useRef(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();
    const website = String(data.get("website") ?? "");

    if (!name) return setStatus({ kind: "error", message: errors.name, offerWhatsapp: false });
    if (!EMAIL.test(email)) return setStatus({ kind: "error", message: errors.email, offerWhatsapp: false });

    sending.current = true;
    setStatus({ kind: "sending" });
    const result = endpoint
      ? await submitLead({ name, email, ...(phone && { phone }), ...(message && { message }), website }, endpoint, fetchImpl)
      : ({ ok: false, reason: "network" } as const);
    sending.current = false;

    if (result.ok) return setStatus({ kind: "sent" });
    const message_ = result.reason === "invalid" ? errors.invalid : result.reason === "rate" ? errors.rate : errors.network;
    setStatus({ kind: "error", message: message_, offerWhatsapp: result.reason !== "invalid" });
  }

  if (status.kind === "sent") {
    return (
      <p role="status" className="m-0 font-display text-xl font-light text-mist">
        {copy.contact.sent}
      </p>
    );
  }

  const busy = status.kind === "sending";
  return (
    <>
    <noscript>
      <p className="m-0 max-w-xl font-display text-base font-light text-mist">
        Para enviar a mensagem por aqui, ative o JavaScript do navegador
        {whatsappUrl ? (
          <>
            {" "}
            ou fale pelo{" "}
            <a href={whatsappUrl} className="underline underline-offset-4">
              {copy.contact.whatsapp}
            </a>
          </>
        ) : null}
        .
      </p>
    </noscript>
    <form hidden={!hydrated} onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-5">
      <div>
        <label htmlFor="contact-name" className={labelClass}>
          {copy.contact.name}
        </label>
        <input id="contact-name" name="name" autoComplete="name" required maxLength={120} className={fieldClass} />
      </div>
      <div>
        <label htmlFor="contact-email" className={labelClass}>
          {copy.contact.email}
        </label>
        <input id="contact-email" name="email" type="email" autoComplete="email" required maxLength={254} className={fieldClass} />
      </div>
      <div>
        <label htmlFor="contact-phone" className={labelClass}>
          {copy.contact.phone}
        </label>
        <input id="contact-phone" name="phone" type="tel" autoComplete="tel" maxLength={40} className={fieldClass} />
      </div>
      <div>
        <label htmlFor="contact-message" className={labelClass}>
          {copy.contact.message}
        </label>
        <textarea id="contact-message" name="message" rows={4} maxLength={2000} className={fieldClass} />
      </div>

      {/* Campo-isca: fora da ordem de tabulação, escondido de leitores de tela e fora da tela. Robôs o preenchem. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-teal px-8 py-4 font-label text-xs font-bold tracking-[0.2em] text-graphite uppercase disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          {busy ? copy.contact.sending : copy.contact.submit}
        </button>
        <div aria-live="polite" className="min-h-6 font-display text-sm text-gray-300">
          {status.kind === "error" && (
            <p role="alert" className="m-0 text-amber">
              {status.message}
              {status.offerWhatsapp && whatsappUrl && (
                <>
                  {" "}
                  {errors.alternative}{" "}
                  <a href={whatsappUrl} className="underline underline-offset-4">
                    {copy.contact.whatsapp}
                  </a>
                  .
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </form>
    </>
  );
}
