import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ContactForm } from "../src/components/ContactForm";
import { LocaleProvider } from "../src/components/LocaleProvider";
import { getCopy } from "../src/content/copy/index";
import { LANGS } from "../src/lib/i18n/config";

// O <noscript> do formulário é HTML do servidor: quem está sem JavaScript lê o aviso no idioma da página.
describe("ContactForm without JavaScript (server HTML)", () => {
  for (const lang of LANGS) {
    it(`${lang}: the notice and the WhatsApp alternative are in the page language`, () => {
      const copy = getCopy(lang).contact;
      const html = renderToStaticMarkup(
        <LocaleProvider lang={lang} page="home" languages={[lang]}>
          <ContactForm endpoint="/api/lead" whatsappUrl="https://wa.me/5500000000000" />
        </LocaleProvider>,
      );
      const noscript = html.slice(html.indexOf("<noscript>"), html.indexOf("</noscript>"));
      expect(noscript).toContain(copy.noscript);
      expect(noscript).toContain(copy.noscriptOr);
      expect(noscript).toContain(copy.whatsapp);
      if (lang !== "pt") expect(noscript).not.toMatch(/ative o JavaScript|fale pelo/i);
    });

    it(`${lang}: without a WhatsApp link the notice still ends cleanly`, () => {
      const copy = getCopy(lang).contact;
      const html = renderToStaticMarkup(
        <LocaleProvider lang={lang} page="home" languages={[lang]}>
          <ContactForm endpoint="/api/lead" />
        </LocaleProvider>,
      );
      const noscript = html.slice(html.indexOf("<noscript>"), html.indexOf("</noscript>"));
      expect(noscript).toContain(copy.noscript);
      expect(noscript).not.toContain(copy.noscriptOr);
    });
  }
});
