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
  /** Espessura da extrusão em em (padrão 0.14). */
  depth?: number;
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
 * Título extrudado em 3D: uma malha por palavra (a palavra-chave leva outra cor), material físico levemente
 * translúcido e uma luz quente coerente com a cena do vídeo.
 */
export async function createTitle3D(opts: Title3DOptions): Promise<Title3D> {
  const font = await loadFont(opts.fontUrl);
  const depth = opts.depth ?? 0.14;
  const lines = layoutLines(opts.text, opts.maxWidthEm ?? 12, (s) => font.getAdvanceWidth(s, 1));

  const makeMaterial = (color: number) =>
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.4,
      metalness: 0.05,
      clearcoat: 0.5,
      clearcoatRoughness: 0.3,
      emissive: 0x2a1c08,
      emissiveIntensity: 0.15,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
  // Pré-passe de profundidade: só a face mais próxima de cada palavra é pintada, sem as faces de trás
  // transparecendo por cima (que manchavam as letras quando o material é translúcido).
  const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });
  const base = makeMaterial(opts.color);
  const keyword = opts.keywordColor !== undefined ? makeMaterial(opts.keywordColor) : base;
  const materials = keyword === base ? [base] : [base, keyword];

  const height = blockHeightEm(lines.length);
  const object = new THREE.Group();
  const inner = new THREE.Group();
  object.add(inner);
  // Luzes físicas (r155+): precisam de intensidade ~π para um branco ficar branco. Luz principal levemente quente.
  object.add(new THREE.HemisphereLight(0xffffff, 0x4a3a28, 1.6));
  const key = new THREE.DirectionalLight(0xfff1dc, 2.6);
  key.position.set(2, 3, 4);
  object.add(key);

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
      const geometry = new THREE.ExtrudeGeometry(pathToShapes(font.getPath(word, x, 0, 1)), {
        depth,
        curveSegments: 10,
        bevelEnabled: true,
        bevelThickness: 0.012,
        bevelSize: 0.008,
        bevelSegments: 2,
      });
      geometries.push(geometry);
      const prepass = new THREE.Mesh(geometry, depthOnly);
      prepass.renderOrder = 0;
      const mesh = new THREE.Mesh(geometry, wordIndex === opts.keywordIndex ? keyword : base);
      mesh.renderOrder = 1;
      for (const m of [prepass, mesh]) {
        m.position.y = y;
        inner.add(m);
      }
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
      depthOnly.dispose();
    },
  };
}
