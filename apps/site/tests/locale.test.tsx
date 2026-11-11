// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContactForm } from "../src/components/ContactForm";
import { Footer } from "../src/components/Footer";
import { LocaleProvider, useCopy, useLang, useLanguages, usePageKey } from "../src/components/LocaleProvider";
import { statusByLang } from "../src/content/status";

afterEach(cleanup);

function Probe() {
  const copy = useCopy();
  return (
    <p>
      {copy.hero.eyebrow}|{useLang()}|{usePageKey()}|{useLanguages().join(",")}
    </p>
  );
}

describe("LocaleProvider", () => {
  it("hands the copy, language, page and published languages to client components", () => {
    render(
      <LocaleProvider lang="en" page="privacy" languages={["pt", "en"]}>
        <Probe />
      </LocaleProvider>,
    );
    expect(screen.getByText("MARKETING WITH AI AND AUTOMATION|en|privacy|pt,en")).toBeTruthy();
  });

  it("fails loudly when a component is rendered without a provider", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/LocaleProvider/);
    error.mockRestore();
  });
});

describe("ContactForm in another language", () => {
  it("shows the Spanish labels, button and validation message", () => {
    render(
      <LocaleProvider lang="es" page="home" languages={["pt", "es"]}>
        <ContactForm endpoint="/api/lead" fetchImpl={vi.fn() as unknown as typeof fetch} />
      </LocaleProvider>,
    );
    expect(screen.getByLabelText(/^nombre/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));
    expect(screen.getByText("Escribe tu nombre.")).toBeTruthy();
  });
});

describe("Footer", () => {
  it("renders the English phrase and links to the English legal pages", () => {
    const { container } = render(
      <LocaleProvider lang="en" page="home" languages={["pt", "en"]}>
        <Footer lang="en" />
      </LocaleProvider>,
    );
    expect(container.querySelector("h2")?.textContent).toBe("LET'S\nTALK?");
    const hrefs = [...container.querySelectorAll("footer a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/en/privacy");
    expect(hrefs).toContain("/en/terms");
  });
});

describe("statusByLang", () => {
  it("reports the copy and legal status of each language (pt, en and es approved)", () => {
    expect(statusByLang()).toEqual({
      pt: { copy: "final", legal: "final" },
      en: { copy: "final", legal: "final" },
      es: { copy: "final", legal: "final" },
    });
  });
});
