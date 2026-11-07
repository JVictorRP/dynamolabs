import type { SiteSection } from "./choreo/header-state";
import type { TitleState } from "./choreo/title-motion";
import type { DrawPlan } from "./stage/types";

declare global {
  interface Window {
    /** Só nas rotas de laboratório (/lab/*), para os testes e2e. */
    __lab?: {
      setProgress(p: number): void;
      settled(): Promise<void>;
      lastDraw(): DrawPlan | null;
      renderer: "webgl" | "canvas2d";
    };
    /** Só em /lab/title: aplica um estado ao título 3D e redesenha. */
    __labTitle?: { size: { width: number; height: number }; setState(s: TitleState): void; isVisible(): boolean; renderer: "webgl" | "canvas2d" };
    /** Só em /lab/header: muda a seção e o progresso que o menu recebe. */
    __labHeader?: { set(section: SiteSection, p: number): void };
    /** Progresso suavizado de cada palco e o histórico dos valores publicados (para testes e depuração). */
    __dynamo?: {
      progress: Record<string, number>;
      /** Topo de cada palco em fração da altura da tela (1 = abaixo da tela, 0 = no topo). */
      edge?: Record<string, number>;
      history: number[];
      /** Resolve quando os frames do palco chegaram e o quadro foi desenhado (usado pelos testes). */
      settle?: Record<string, () => Promise<void>>;
      /** Últimos estados aplicados aos títulos 3D (usado pelos testes). */
      titles?: { hero: TitleState; s2: TitleState };
      /** Ganchos de depuração/teste: esconder todo o texto para medir o fundo. */
      debug?: { hideText(hidden: boolean): void };
    };
  }
}
export {};
