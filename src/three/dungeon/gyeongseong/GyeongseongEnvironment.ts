import * as THREE from "three";
import type { DungeonMapDefinition } from "../../../game/dungeon/dungeonTypes";
import { BUILDING_FOOTPRINTS, CELL, GROUND_Y, planGyeongseongLayout, type BuildingModelId, type GyeongseongLayout, type RoadTileId } from "./gyeongseongLayout";

/**
 * Stylised 1900s Gyeongseong for Unit 3 Floor 1, built from the supplied FBX models (converted to the
 * compact GSM1 meshes in public/assets/chapter3/gyeongseong). The dungeon camera, navigation, minimap,
 * first-person weapon and combat transitions are untouched — this only replaces the room/corridor visuals.
 *
 * Performance: one geometry + one material per model, one InstancedMesh per model/tile type (road tile
 * material colours are baked into vertex colours so each tile type is a single draw call), Lambert lighting,
 * and everything is disposed with the dungeon screen.
 */
const BASE = `${import.meta.env.BASE_URL}assets/chapter3/gyeongseong/`;
const SKY_TOP = new THREE.Color(0x6f9fd6);
const SKY_HORIZON = new THREE.Color(0xd9d2c2);
const GROUND_COLOR = 0x2c2724;

export type GyeongseongEnvironment = {
  root: THREE.Group;
  fog: THREE.Fog;
  background: THREE.Color;
  layout: GyeongseongLayout;
  ready: Promise<void>;
  update(camera: THREE.Camera): void;
  dispose(): void;
};

type ParsedMesh = { geometry: THREE.BufferGeometry; groupCount: number };

/** GSM1: u32 magic, vertexCount, groupCount, hasUv | u32 groupVertexCounts[] | f32 pos[n*3] | f32 normal[n*3] | f32 uv[n*2]? */
export function parseGsm(buffer: ArrayBuffer, groupColors?: THREE.Color[]): ParsedMesh {
  const header = new Uint32Array(buffer, 0, 4);
  if (header[0] !== 0x314d5347) throw new Error("not a GSM1 mesh");
  const [, n, groupCount, hasUv] = header;
  const counts = new Uint32Array(buffer, 16, groupCount);
  let offset = 16 + groupCount * 4;
  const position = new Float32Array(buffer, offset, n * 3); offset += n * 12;
  const normal = new Float32Array(buffer, offset, n * 3); offset += n * 12;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  if (hasUv) geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(buffer, offset, n * 2), 2));
  if (groupColors) {
    const colors = new Float32Array(n * 3);
    let vertex = 0;
    counts.forEach((count, group) => {
      const color = groupColors[group] ?? new THREE.Color(0x555555);
      for (let k = 0; k < count; k += 1, vertex += 1) colors.set([color.r, color.g, color.b], vertex * 3);
    });
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  }
  geometry.computeBoundingSphere();
  return { geometry, groupCount };
}

type Manifest = Record<string, { materials: { name: string; color: string }[] }>;

export function createGyeongseongEnvironment(map: DungeonMapDefinition, seed: string): GyeongseongEnvironment {
  const layout = planGyeongseongLayout(map, seed);
  const root = new THREE.Group();
  root.name = "GyeongseongEnvironment";
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  let disposed = false;

  /* ---- sky dome (follows the camera), fog, light */
  const skyGeometry = new THREE.SphereGeometry(92, 24, 12);
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: SKY_TOP.clone() }, horizon: { value: SKY_HORIZON.clone() } },
    vertexShader: "varying float vY; void main(){ vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform vec3 top;\nuniform vec3 horizon;\nvarying float vY;\nvoid main(){\n  float t = smoothstep(-0.05, 0.55, vY);\n  gl_FragColor = vec4(mix(horizon, top, t), 1.0);\n  #include <colorspace_fragment>\n}",
  });
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  root.add(sky);
  geometries.push(skyGeometry); materials.push(skyMaterial);

  const hemisphere = new THREE.HemisphereLight(0xe7eeff, 0x5d4c3c, 1.7);
  const sun = new THREE.DirectionalLight(0xffe6c4, 1.5);
  sun.position.set(-30, 60, 20);
  root.add(hemisphere, sun);

  /* ---- ground under everything (no holes even before the tiles load) */
  const { minI, maxI, minJ, maxJ } = layout.bounds;
  const groundGeometry = new THREE.PlaneGeometry((maxI - minI + 30) * CELL, (maxJ - minJ + 30) * CELL);
  const groundMaterial = new THREE.MeshLambertMaterial({ color: GROUND_COLOR });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(((minI + maxI) / 2) * CELL, GROUND_Y - 0.12, ((minJ + maxJ) / 2) * CELL);
  root.add(ground);
  geometries.push(groundGeometry); materials.push(groundMaterial);

  /*
   * ---- solid blocks for closed cells no building covers: simple brick / plaster masses with a pixel-art
   * façade texture drawn at runtime (windows, mortar lines, a tiled roof cap), tinted per instance.
   */
  const brickTexture = createFacadeTexture("brick");
  const plasterTexture = createFacadeTexture("plaster");
  const roofTexture = createFacadeTexture("roof");
  textures.push(brickTexture, plasterTexture, roofTexture);
  const blockGeometry = new THREE.BoxGeometry(CELL, 1, CELL);
  blockGeometry.translate(0, 0.5, 0);
  geometries.push(blockGeometry);
  const roofMaterial = new THREE.MeshLambertMaterial({ map: roofTexture });
  materials.push(roofMaterial);
  const palette = [0xffffff, 0xf0e2d2, 0xe0d0c0, 0xfff4e4, 0xd8c8b8].map((hex) => new THREE.Color(hex));
  const matrix = new THREE.Matrix4();
  (["brick", "plaster"] as const).forEach((kind) => {
    const facade = new THREE.MeshLambertMaterial({ map: kind === "brick" ? brickTexture : plasterTexture });
    materials.push(facade);
    const subset = layout.blocks.filter((block) => (block.tone < 0.55) === (kind === "brick"));
    if (subset.length === 0) return;
    // BoxGeometry groups: +x, −x, +y (roof), −y, +z, −z
    const mesh = new THREE.InstancedMesh(blockGeometry, [facade, facade, roofMaterial, roofMaterial, facade, facade], subset.length);
    subset.forEach((block, index) => {
      matrix.compose(new THREE.Vector3(block.x, GROUND_Y, block.z), new THREE.Quaternion(), new THREE.Vector3(1, block.height, 1));
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, palette[Math.floor(block.tone * 97) % palette.length]);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.name = `blocks:${kind}`;
    root.add(mesh);
  });

  /* ---- converted FBX meshes: buildings and road tiles */
  const loadBinary = (name: string) => fetch(`${BASE}meshes/${name}.bin`).then((response) => {
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    return response.arrayBuffer();
  });
  const textureLoader = new THREE.TextureLoader();
  const loadTexture = (name: string) => new Promise<THREE.Texture>((resolve, reject) => {
    textureLoader.load(`${BASE}textures/${name}.jpg`, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      resolve(texture);
    }, undefined, reject);
  });

  /**
   * Road LOD: the stone tiles (~780 triangles each) are only drawn in full detail near the camera; farther
   * tiles use a flat quad in the tile's average colour (fog hides the difference). Re-bucketed when the
   * camera has moved more than LOD_REBUCKET units.
   */
  const LOD_RADIUS = 15;
  const LOD_REBUCKET = 2;
  type TileLod = { detailed: THREE.InstancedMesh; flat: THREE.InstancedMesh; placements: typeof layout.tiles; matrices: THREE.Matrix4[] };
  const tileLods: TileLod[] = [];
  const lastLodPosition = new THREE.Vector3(Infinity, 0, 0);
  const rebucket = (position: THREE.Vector3) => {
    for (const lod of tileLods) {
      let near = 0, far = 0;
      lod.placements.forEach((placement, index) => {
        const dx = placement.x - position.x, dz = placement.z - position.z;
        if (dx * dx + dz * dz < LOD_RADIUS * LOD_RADIUS) lod.detailed.setMatrixAt(near++, lod.matrices[index]);
        else lod.flat.setMatrixAt(far++, lod.matrices[index]);
      });
      lod.detailed.count = near; lod.flat.count = far;
      lod.detailed.instanceMatrix.needsUpdate = true; lod.flat.instanceMatrix.needsUpdate = true;
    }
  };
  const flatTileGeometry = new THREE.PlaneGeometry(CELL, CELL);
  flatTileGeometry.rotateX(-Math.PI / 2);
  flatTileGeometry.translate(0, -0.01, 0);
  geometries.push(flatTileGeometry);

  const usedModels = [...new Set(layout.buildings.map((b) => b.model))] as BuildingModelId[];
  const usedTiles = [...new Set(layout.tiles.map((t) => t.tile))] as RoadTileId[];

  const ready = (async () => {
    const manifest = await fetch(`${BASE}meshes/manifest.json`).then((response) => response.json() as Promise<Manifest>);
    await Promise.all([
      ...usedModels.map(async (model) => {
        const [buffer, texture] = await Promise.all([loadBinary(model), loadTexture(model)]);
        if (disposed) { texture.dispose(); return; }
        const { geometry } = parseGsm(buffer);
        const material = new THREE.MeshLambertMaterial({ map: texture });
        geometries.push(geometry); materials.push(material); textures.push(texture);
        const placements = layout.buildings.filter((b) => b.model === model);
        const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
        placements.forEach((placement, index) => {
          matrix.compose(
            new THREE.Vector3(placement.x, GROUND_Y, placement.z),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), placement.rotationY),
            new THREE.Vector3(placement.scale, placement.scale, placement.scale),
          );
          mesh.setMatrixAt(index, matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.name = `building:${model}`;
        root.add(mesh);
      }),
      ...usedTiles.map(async (tile) => {
        const buffer = await loadBinary(tile);
        if (disposed) return;
        const colors = manifest[tile]?.materials.map((m) => new THREE.Color(`#${m.color}`).multiplyScalar(1.35));
        const { geometry } = parseGsm(buffer, colors);
        const material = new THREE.MeshLambertMaterial({ vertexColors: true });
        geometries.push(geometry); materials.push(material);
        const placements = layout.tiles.filter((t) => t.tile === tile);
        const matrices = placements.map((placement) => new THREE.Matrix4().compose(
          new THREE.Vector3(placement.x, GROUND_Y, placement.z),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), placement.rotationY),
          new THREE.Vector3(1, 1, 1),
        ));
        const detailed = new THREE.InstancedMesh(geometry, material, placements.length);
        // average colour of the tile's top faces for the far LOD
        const average = new THREE.Color(0, 0, 0);
        const colorAttribute = geometry.getAttribute("color");
        for (let index = 0; index < colorAttribute.count; index += 1) average.r += colorAttribute.getX(index), average.g += colorAttribute.getY(index), average.b += colorAttribute.getZ(index);
        average.multiplyScalar(1 / Math.max(1, colorAttribute.count));
        const flatMaterial = new THREE.MeshLambertMaterial({ color: average });
        materials.push(flatMaterial);
        const flat = new THREE.InstancedMesh(flatTileGeometry, flatMaterial, placements.length);
        [detailed, flat].forEach((mesh) => { mesh.frustumCulled = false; mesh.name = `road:${tile}`; root.add(mesh); });
        tileLods.push({ detailed, flat, placements, matrices });
        lastLodPosition.set(Infinity, 0, 0);
      }),
    ]);
  })();

  return {
    root,
    layout,
    fog: new THREE.Fog(SKY_HORIZON.getHex(), 24, 82),
    background: SKY_HORIZON.clone(),
    ready,
    update: (camera) => {
      sky.position.copy(camera.position);
      const dx = camera.position.x - lastLodPosition.x, dz = camera.position.z - lastLodPosition.z;
      if (tileLods.length && !(dx * dx + dz * dz < LOD_REBUCKET * LOD_REBUCKET)) {
        lastLodPosition.copy(camera.position);
        rebucket(camera.position);
      }
    },
    dispose: () => {
      disposed = true;
      root.removeFromParent();
      root.traverse((object) => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
    },
  };
}

/** 64×64 pixel-art façade textures (nearest filtering), drawn once per dungeon. */
function createFacadeTexture(kind: "brick" | "plaster" | "roof"): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    if (kind === "roof") {
      ctx.fillStyle = "#3b3a40"; ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = "#2b2a30";
      for (let y = 0; y < 64; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < 64; x += 8) ctx.fillRect(x, y + 6, 8, 2);
    } else {
      ctx.fillStyle = kind === "brick" ? "#8a4f3a" : "#cdbb9c"; ctx.fillRect(0, 0, 64, 64);
      if (kind === "brick") {
        ctx.fillStyle = "#6c3b2c";
        for (let y = 0; y < 64; y += 4) { ctx.fillRect(0, y + 3, 64, 1); for (let x = (y / 4) % 2 ? 4 : 0; x < 64; x += 8) ctx.fillRect(x, y, 1, 3); }
      } else {
        ctx.fillStyle = "#b7a383"; ctx.fillRect(0, 30, 64, 2); ctx.fillRect(0, 62, 64, 2);
      }
      // two windows per floor, two floors per texture
      for (const wy of [8, 40]) for (const wx of [10, 40]) {
        ctx.fillStyle = "#3d2a22"; ctx.fillRect(wx - 2, wy - 2, 18, 20);
        ctx.fillStyle = "#2a3446"; ctx.fillRect(wx, wy, 14, 16);
        ctx.fillStyle = "#3d2a22"; ctx.fillRect(wx + 6, wy, 2, 16); ctx.fillRect(wx, wy + 7, 14, 2);
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export const GYEONGSEONG_MODEL_IDS = Object.keys(BUILDING_FOOTPRINTS) as BuildingModelId[];
