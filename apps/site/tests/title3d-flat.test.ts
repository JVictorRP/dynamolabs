import { readFileSync } from "node:fs";
import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTitle3D } from "../src/lib/title3d/title3d";

const ttf = readFileSync(new URL("../public/fonts/ArchivoBlack-Regular.ttf", import.meta.url));

afterEach(() => vi.unstubAllGlobals());

// O título se move em 3D (rotação, profundidade da cena), mas a letra em si é plana: sem espessura e sem sombreado.
describe("createTitle3D draws flat letters (no extrusion), still free to move in 3D", () => {
  it("every glyph mesh has zero thickness and the title brings no lights of its own", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength))));
    const title = await createTitle3D({ text: "SUA MARCA\nEM MOVIMENTO", fontUrl: "/fonts/flat.ttf", color: 0xffffff, keywordIndex: 3, keywordColor: 0xffb339 });
    const meshes: THREE.Mesh[] = [];
    let lights = 0;
    title.object.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
      if ((o as THREE.Light).isLight) lights++;
    });
    expect(meshes.length).toBeGreaterThan(0);
    for (const mesh of meshes) {
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox!;
      expect(box.max.z - box.min.z).toBe(0);
    }
    expect(lights).toBe(0);
    // Continua se movendo em 3D: dobrar o título não achata nem some com ele.
    title.setState({ rotX: -0.6, z: -1, opacity: 0.5, x: 0, y: 0 });
    expect(title.object.visible).toBe(true);
    title.dispose();
  });
});
