import * as THREE from "three";
import { parse, type Font, type Path } from "opentype.js";
import type { TitleState } from "../choreo/title-motion";
import { blockHeightEm, layoutLines, LINE_HEIGHT } from "./layout-lines";

export type Title3DOptions = {
  text: string;
  /** Arquivo TTF (Archivo Black, OFL). */
  fontUrl: string;
  color: number;
  /** Índice (0-based, contando as palavras do texto inteiro) da palavra-chave destacada. */
  keywordIndex?: number;
  keywordColor?: number;
  /** Largura máxima em em antes de quebrar linha (padrão 12). */
  maxWidthEm?: number;
};

export type Title3D = {
  /**
   * Origem no centro vertical do bloco e na borda esquerda do texto; 1 unidade = 1 em.
   * O consumidor posiciona e escala este grupo; as luzes do título vão dentro dele.
   */
  object: THREE.Group;
  size: { width: number; height: number };
  setState(state: TitleState): void;
  dispose(): void;
};

const fonts = new Map<string, Promise<Font>>();
function loadFont(url: string): Promise<Font> {
  let font = fonts.get(url);
  if (!font) {
    font = fetch(url).then(async (res) => {
      if (!res.ok) throw new Error(`fonte indisponível: ${url}`);
      return parse(await res.arrayBuffer());
    });
    fonts.set(url, font);
    // Uma falha não pode ficar no cache: senão toda tentativa seguinte receberia a mesma promessa rejeitada.
    font.catch(() => fonts.delete(url));
  }
  return font;
}

/** Contornos do opentype (y para baixo) → formas do Three (y para cima). Os furos saem da regra par-ímpar do `toShapes`. */
function pathToShapes(path: Path): THREE.Shape[] {
  const shapePath = new THREE.ShapePath();
  for (const c of path.commands) {
    if (c.type === "M") shapePath.moveTo(c.x, -c.y);
    else if (c.type === "L") shapePath.lineTo(c.x, -c.y);
    else if (c.type === "Q") shapePath.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y);
    else if (c.type === "C") shapePath.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
  }
  return shapePath.toShapes();
}

/**
 * Título para a cena 3D: uma malha por palavra (a palavra-chave leva outra cor). A letra é PLANA (sem espessura e sem
 * sombreado, a cor é exatamente a do design system); o 3D está no movimento (dobra, profundidade, perspectiva).
 */
export async function createTitle3D(opts: Title3DOptions): Promise<Title3D> {
  const font = await loadFont(opts.fontUrl);
  const lines = layoutLines(opts.text, opts.maxWidthEm ?? 12, (s) => font.getAdvanceWidth(s, 1));

  const makeMaterial = (color: number) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false, toneMapped: false });
  const base = makeMaterial(opts.color);
  const keyword = opts.keywordColor !== undefined ? makeMaterial(opts.keywordColor) : base;
  const materials = keyword === base ? [base] : [base, keyword];

  const height = blockHeightEm(lines.length);
  const object = new THREE.Group();
  const inner = new THREE.Group();
  object.add(inner);

  const geometries: THREE.BufferGeometry[] = [];
  let wordIndex = 0;
  let width = 0;
  lines.forEach((line, lineIndex) => {
    width = Math.max(width, font.getAdvanceWidth(line, 1));
    const y = (lines.length - 1 - lineIndex) * LINE_HEIGHT - height / 2;
    let from = 0;
    for (const word of line.split(" ")) {
      const start = line.indexOf(word, from);
      from = start + word.length;
      const x = font.getAdvanceWidth(line.slice(0, start), 1);
      const geometry = new THREE.ShapeGeometry(pathToShapes(font.getPath(word, x, 0, 1)), 10);
      geometries.push(geometry);
      const mesh = new THREE.Mesh(geometry, wordIndex === opts.keywordIndex ? keyword : base);
      mesh.position.y = y;
      inner.add(mesh);
      wordIndex++;
    }
  });

  return {
    object,
    size: { width, height },
    setState(state) {
      inner.rotation.x = state.rotX;
      inner.position.set(state.x, state.y, state.z);
      for (const m of materials) m.opacity = state.opacity;
      object.visible = state.opacity > 0.001;
    },
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
