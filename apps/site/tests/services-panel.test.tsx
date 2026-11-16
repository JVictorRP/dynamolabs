// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServicesPanel } from "../src/components/ServicesPanel";

const SERVICES = [
  { name: "Tráfego pago", text: "Campanhas ajustadas todos os dias." },
  { name: "Criativo e conteúdo", text: "Posts e Reels em escala." },
  { name: "Sites e landing pages", text: "Páginas feitas para converter." },
];

beforeEach(() => {
  vi.useFakeTimers();
  // O jsdom não tem ResizeObserver (o GlassSurface mede o próprio tamanho com ele).
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const setup = (live = true) => render(<ServicesPanel label="Serviços da Dynamo" services={SERVICES} live={live} />);
const button = (name: string) => screen.getByRole("button", { name });
const card = (i: number) => document.querySelector<HTMLElement>(`[data-service-card="${i}"]`)!;

describe("ServicesPanel (menu de serviços da seção 2)", () => {
  it("lista os serviços num menu com nome acessível e um botão por serviço", () => {
    setup();
    expect(screen.getByRole("navigation", { name: "Serviços da Dynamo" })).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("em repouso nenhum card está ativo", () => {
    setup();
    expect([0, 1, 2].map((i) => card(i).dataset.state)).toEqual(["rest", "rest", "rest"]);
  });

  it("passar o mouse num serviço traz o card dele à frente e esmaece os outros", () => {
    setup();
    fireEvent.pointerEnter(button("Criativo e conteúdo"), { pointerType: "mouse" });
    expect([0, 1, 2].map((i) => card(i).dataset.state)).toEqual(["dim", "active", "dim"]);
  });

  it("o foco do teclado faz o mesmo que o mouse", () => {
    setup();
    fireEvent.focus(button("Sites e landing pages"));
    expect([0, 1, 2].map((i) => card(i).dataset.state)).toEqual(["dim", "dim", "active"]);
  });

  it("tocar (clique) seleciona o serviço e tocar de novo no mesmo o mantém", () => {
    setup();
    fireEvent.click(button("Tráfego pago"));
    fireEvent.click(button("Tráfego pago"));
    expect(card(0).dataset.state).toBe("active");
  });

  it("ao sair do menu (com uma pequena folga) volta ao repouso, sem piscar ao passar de um serviço para o vizinho", () => {
    setup();
    fireEvent.pointerEnter(button("Tráfego pago"), { pointerType: "mouse" });
    fireEvent.pointerLeave(button("Tráfego pago"), { pointerType: "mouse" });
    fireEvent.pointerEnter(button("Criativo e conteúdo"), { pointerType: "mouse" });
    act(() => void vi.advanceTimersByTime(300));
    expect(card(1).dataset.state).toBe("active");
    fireEvent.pointerLeave(button("Criativo e conteúdo"), { pointerType: "mouse" });
    act(() => void vi.advanceTimersByTime(300));
    expect(card(1).dataset.state).toBe("rest");
  });

  it("os cards são só visuais: não recebem mouse nem toque (o controle é o menu)", () => {
    setup();
    expect(document.querySelector<HTMLElement>("[data-service-deck]")!.className).toContain("pointer-events-none");
  });

  it("Escape volta ao repouso", () => {
    setup();
    fireEvent.click(button("Tráfego pago"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(card(0).dataset.state).toBe("rest");
  });

  it("o texto de cada serviço fica ligado ao botão por aria-describedby (também para quem usa leitor de tela)", () => {
    setup();
    const target = document.getElementById(button("Criativo e conteúdo").getAttribute("aria-describedby")!);
    expect(target?.textContent).toBe("Posts e Reels em escala.");
  });

  it("fora da seção (live=false) o painel inteiro fica inerte: nada de foco nem de mouse", () => {
    const { container } = setup(false);
    expect(container.querySelectorAll("[inert]").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("[inert] button").length).toBe(3);
  });
});
