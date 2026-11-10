import { getCopy } from "@/content/copy/index";
import type { Lang } from "@/lib/i18n/config";
import { SITE } from "@/content/site";
import { ContactForm } from "./ContactForm";

/** Footer (fundo `void`): continua o escuro do vídeo 2, que termina em preto. */
export function Footer({ lang }: { lang: Lang }) {
  const copy = getCopy(lang);
  const contacts = [
    SITE.whatsappUrl && { label: "WhatsApp", href: SITE.whatsappUrl },
    SITE.email && { label: SITE.email, href: `mailto:${SITE.email}` },
    SITE.instagram && { label: "Instagram", href: SITE.instagram },
    SITE.linkedin && { label: "LinkedIn", href: SITE.linkedin },
  ].filter((c): c is { label: string; href: string } => Boolean(c));

  const link = "font-display text-sm font-medium tracking-[0.22em] text-mist uppercase hover:text-amber focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white";

  return (
    <footer id="contato" className="relative bg-void px-[5vw] pt-24 pb-10 text-white">
      <h2 className="m-0 font-display text-[clamp(36px,11vw,190px)] leading-[0.85] font-black tracking-[-0.04em] whitespace-pre uppercase">{copy.footer.phrase}</h2>
      <div className="mt-14 grid gap-14 md:grid-cols-[minmax(0,40rem)_1fr]">
        <ContactForm />
        <div className="flex flex-wrap content-start gap-x-20 gap-y-8 md:justify-end">
        <nav aria-label={copy.aria.footerNav} className="flex flex-col gap-3">
          {copy.footer.nav.map((item) => (
            <a key={item.href} href={item.href} className={link}>
              {item.label}
            </a>
          ))}
        </nav>
        {contacts.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {contacts.map((c) => (
              <li key={c.href}>
                <a href={c.href} className={link}>
                  {c.label}
                </a>
              </li>
            ))}
          </ul>
        )}
        </div>
      </div>

      <div className="mt-16 flex flex-wrap items-end justify-between gap-6 border-t border-graphite pt-8">
        <div className="flex flex-col gap-5">
          <img src="/brand/dynamo-lockup-claro.png" alt="Dynamo Labs" className="w-40" />
          <p className="m-0 font-display text-[clamp(10px,1vw,13px)] font-medium tracking-[0.22em] text-gray-300 uppercase">{copy.footer.line}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 font-display text-xs text-gray-300">
          {copy.footer.legal.map((item) => (
            <a key={item.href} href={item.href} className="underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
              {item.label}
            </a>
          ))}
          <span>© {new Date().getFullYear()} Dynamo</span>
        </div>
      </div>
    </footer>
  );
}
