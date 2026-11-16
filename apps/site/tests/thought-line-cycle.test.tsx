// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThoughtLineCycle } from "../src/components/ThoughtLineCycle";

const PHRASES = ["Analisando seu público…", "Criando os anúncios…", "Otimizando a campanha…"];

function mockMotionPreference(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const shown = (root: HTMLElement) => PHRASES.filter((p) => root.textContent?.includes(p));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ThoughtLineCycle (decoração do hero)", () => {
  it("começa pela primeira frase e passa para a seguinte a cada intervalo, voltando ao início no fim", () => {
    mockMotionPreference(false);
    const { container } = render(<ThoughtLineCycle phrases={PHRASES} intervalMs={1000} />);
    expect(shown(container)).toEqual([PHRASES[0]]);
    act(() => void vi.advanceTimersByTime(1000));
    expect(shown(container)).toEqual([PHRASES[1]]);
    act(() => void vi.advanceTimersByTime(1000));
    expect(shown(container)).toEqual([PHRASES[2]]);
    act(() => void vi.advanceTimersByTime(1000));
    expect(shown(container)).toEqual([PHRASES[0]]);
  });

  it("com 'reduzir movimento' fica parada na primeira frase", () => {
    mockMotionPreference(true);
    const { container } = render(<ThoughtLineCycle phrases={PHRASES} intervalMs={1000} />);
    act(() => void vi.advanceTimersByTime(5000));
    expect(shown(container)).toEqual([PHRASES[0]]);
  });

  it("é decorativa: escondida das tecnologias assistivas", () => {
    mockMotionPreference(false);
    const { container } = render(<ThoughtLineCycle phrases={PHRASES} />);
    expect((container.firstElementChild as HTMLElement).getAttribute("aria-hidden")).toBe("true");
  });

  it("sem frases não desenha nada", () => {
    mockMotionPreference(false);
    const { container } = render(<ThoughtLineCycle phrases={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
