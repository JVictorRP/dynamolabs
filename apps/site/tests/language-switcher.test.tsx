// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LanguageSwitcher } from "../src/components/LanguageSwitcher";
import { LocaleProvider } from "../src/components/LocaleProvider";
import type { Lang, PageKey } from "../src/lib/i18n/config";

afterEach(cleanup);

function setup(lang: Lang = "pt", page: PageKey = "home", languages: readonly Lang[] = ["pt", "en", "es"]) {
  return render(
    <LocaleProvider lang={lang} page={page} languages={languages}>
      <button>outside</button>
      <LanguageSwitcher languages={languages} />
    </LocaleProvider>,
  );
}

const trigger = () => screen.getByRole("button", { name: /idioma|language/i });

describe("LanguageSwitcher", () => {
  it("shows the current language code on a button named after the language label, closed at first", () => {
    setup();
    expect(trigger().textContent).toContain("PT");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("link", { name: "English" })).toBeNull(); // lista fechada fica escondida
  });

  it("opens on click and lists every published language in its own name, with href, hreflang and lang", () => {
    setup();
    fireEvent.click(trigger());
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    const links = screen.getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href"), a.getAttribute("hreflang"), a.getAttribute("lang")]);
    expect(links).toEqual([
      ["Português", "/", "pt-BR", "pt-BR"],
      ["English", "/en", "en", "en"],
      ["Español", "/es", "es", "es"],
    ]);
  });

  it("marks the current language with aria-current", () => {
    setup("en");
    fireEvent.click(trigger());
    expect(screen.getByRole("link", { name: "English" }).getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("link", { name: "Español" }).getAttribute("aria-current")).toBeNull();
  });

  it("uses the label of the page language", () => {
    setup("es");
    expect(screen.getByRole("button", { name: /idioma/i }).textContent).toContain("ES");
  });

  it("Escape closes the list and returns the focus to the button", () => {
    setup();
    fireEvent.click(trigger());
    screen.getByRole("link", { name: "English" }).focus();
    fireEvent.keyDown(screen.getByRole("link", { name: "English" }), { key: "Escape" });
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger());
  });

  it("a click outside closes it", () => {
    setup();
    fireEvent.click(trigger());
    fireEvent.pointerDown(screen.getByText("outside"));
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("moving the focus out (Tab) closes it", () => {
    setup();
    fireEvent.click(trigger());
    fireEvent.blur(trigger(), { relatedTarget: screen.getByText("outside") });
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps it open while the focus moves between the button and the links", () => {
    setup();
    fireEvent.click(trigger());
    fireEvent.blur(trigger(), { relatedTarget: screen.getByRole("link", { name: "English" }) });
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
  });

  it("clicking the button again closes it", () => {
    setup();
    fireEvent.click(trigger());
    fireEvent.click(trigger());
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("on the legal pages the links go to the same page in the other language", () => {
    setup("en", "privacy");
    fireEvent.click(trigger());
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/privacidade", "/en/privacy", "/es/privacidad"]);
    cleanup();
    setup("pt", "terms");
    fireEvent.click(trigger());
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/termos", "/en/terms", "/es/terminos"]);
  });

  it("lists only the published languages", () => {
    setup("pt", "home", ["pt", "es"]);
    fireEvent.click(trigger());
    expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual(["Português", "Español"]);
  });

  it("renders nothing when there is a single language", () => {
    const { container } = setup("pt", "home", ["pt"]);
    expect(container.querySelector("[data-language-switcher]")).toBeNull();
  });
});
