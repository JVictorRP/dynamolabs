import * as THREE from "three";
import { CAMERA_FOV_DEG, CAMERA_Z } from "./camera";
import type { StageRenderer } from "./types";

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// uCrop = (x0, y0, w, h) como fração do frame, com origem no canto superior esquerdo.
const FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tA;
  uniform sampler2D tB;
  uniform float uMix;
  uniform vec4 uCrop;
  // Véus pretos do design system (degradês só em preto): vinheta base, apoio do hero, apoio da seção 2, respiro.
  uniform float uBase;
  uniform float uHero;
  uniform float uS2;
  uniform float uBreather;
  uniform float uLeftTop;

  float over(float a, float b) { return 1.0 - (1.0 - a) * (1.0 - b); }

  void main() {
    vec2 uv = vec2(uCrop.x + vUv.x * uCrop.z, uCrop.y + (1.0 - vUv.y) * uCrop.w);
    vec3 c = mix(texture2D(tA, uv), texture2D(tB, uv), uMix).rgb;
    vec2 s = vUv; // tela, origem no canto inferior esquerdo

    // Vinheta do DS: radial "ellipse at 60% 40%" (claro até 35%, 88% preto na borda) + linear (45% no topo, claro em 40%, 88% no pé).
    vec2 cB = vec2(0.6, 0.6);
    float dB = length((s - cB) / (max(cB, 1.0 - cB) * 1.41421356));
    float aRadial = 0.88 * clamp((dB - 0.35) / 0.65, 0.0, 1.0);
    float fromTop = 1.0 - s.y;
    float aLinear = fromTop < 0.4 ? 0.45 * (1.0 - fromTop / 0.4) : 0.88 * (fromTop - 0.4) / 0.6;
    float a = uBase * over(aRadial, aLinear);

    // Apoio do hero: elipse 75% x 62% no canto inferior esquerdo.
    float dH = length((s - vec2(0.12, 0.0)) / vec2(0.75, 0.62));
    a = over(a, uHero * 0.82 * (1.0 - clamp(dH / 0.7, 0.0, 1.0)));
    // Apoio da seção 2: elipse na parte superior direita, onde o bloco fica.
    float dS = length((s - vec2(0.82, 0.72)) / vec2(0.62, 0.55));
    a = over(a, uS2 * 0.75 * (1.0 - clamp(dS / 0.72, 0.0, 1.0)));

    // Apoio do vídeo 2: elipse no canto superior esquerdo, onde fica o título.
    float dL = length((s - vec2(0.16, 0.74)) / vec2(0.62, 0.5));
    a = over(a, uLeftTop * 0.78 * (1.0 - clamp(dL / 0.72, 0.0, 1.0)));

    c *= 1.0 - a;
    c = mix(c, vec3(0.0392), uBreather * 0.92);
    gl_FragColor = vec4(c, 1.0);
  }
`;

const TEXTURE_CACHE = 6;

export type WebGLStage = {
  renderer: StageRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Desenha de novo o fundo e a cena 3D com o estado atual. */
  renderAll(): void;
  /** Define a intensidade dos véus pretos do fundo (não desenha; o chamador agenda o quadro). */
  setScrims(scrims: { base: number; hero: number; s2: number; breather: number; leftTop: number }): void;
};

/**
 * Renderer WebGL (Three.js): o frame vira textura de um quadro em tela cheia e a `scene` (títulos 3D)
 * é desenhada por cima, no mesmo contexto — assim o texto translúcido "enxerga" o vídeo atrás.
 */
export function createWebGLStage(canvas: HTMLCanvasElement): WebGLStage {
  const gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  gl.autoClear = false;
  gl.setClearColor(0x0a0a0a, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, 1, 0.1, 100);
  camera.position.set(0, 0, CAMERA_Z);

  const uniforms = {
    tA: { value: null as THREE.Texture | null },
    tB: { value: null as THREE.Texture | null },
    uMix: { value: 0 },
    uCrop: { value: new THREE.Vector4(0, 0, 1, 1) },
    uBase: { value: 0 },
    uHero: { value: 0 },
    uS2: { value: 0 },
    uBreather: { value: 0 },
    uLeftTop: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const bgScene = new THREE.Scene();
  bgScene.add(quad);
  const bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // Cache curto de texturas: um frame é enviado à GPU uma vez só enquanto estiver em uso.
  const textures = new Map<ImageBitmap, THREE.Texture>();
  function textureFor(bitmap: ImageBitmap): THREE.Texture {
    const cached = textures.get(bitmap);
    if (cached) {
      textures.delete(bitmap);
      textures.set(bitmap, cached);
      return cached;
    }
    const texture = new THREE.Texture(bitmap);
    texture.flipY = false; // ImageBitmap: a primeira linha já é o topo
    texture.generateMipmaps = false;
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    textures.set(bitmap, texture);
    while (textures.size > TEXTURE_CACHE) {
      const [oldest, tex] = textures.entries().next().value as [ImageBitmap, THREE.Texture];
      tex.dispose();
      textures.delete(oldest);
    }
    return texture;
  }

  function renderAll() {
    gl.clear();
    gl.render(bgScene, bgCamera);
    gl.clearDepth();
    gl.render(scene, camera);
  }

  const renderer: StageRenderer = {
    resize(width, height, dpr) {
      gl.setPixelRatio(dpr);
      gl.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    draw(a, b, mix, crop) {
      uniforms.tA.value = textureFor(a);
      uniforms.tB.value = textureFor(b);
      uniforms.uMix.value = mix;
      uniforms.uCrop.value.set(crop.sx / a.width, crop.sy / a.height, crop.sw / a.width, crop.sh / a.height);
      renderAll();
    },
    dispose() {
      textures.forEach((t) => t.dispose());
      textures.clear();
      quad.geometry.dispose();
      material.dispose();
      gl.dispose();
    },
  };

  return {
    renderer,
    scene,
    camera,
    renderAll,
    setScrims(scrims) {
      uniforms.uBase.value = scrims.base;
      uniforms.uHero.value = scrims.hero;
      uniforms.uS2.value = scrims.s2;
      uniforms.uBreather.value = scrims.breather;
      uniforms.uLeftTop.value = scrims.leftTop;
    },
  };
}
