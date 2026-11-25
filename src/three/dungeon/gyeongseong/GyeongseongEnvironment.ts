import * as THREE from "three";
import type { DungeonMapDefinition } from "../../../game/dungeon/dungeonTypes";
import { BUILDING_MODEL_IDS, CELL, GROUND_Y, planGyeongseongLayout, type BuildingModelId, type GyeongseongProfile, type GyeongseongLayout, type RoadTileId } from "./gyeongseongLayout";

/**
 * Stylised 1900s Gyeongseong for Unit 3 Floor 1.
 *
 * Buildings: only the supplied FBX models ("3d assets.zip": timber shop, brick corner shop, hanok, station,
 * mansion), converted offline by scripts/chapter3/convert-gyeongseong-buildings.mjs into
 *   - GSM2 (full mesh, its own texture) for buildings near the camera, and
 *   - GSL1 (the same FBX mesh simplified to ~20 % with the texture colours baked into vertex colours)
 *     for distant buildings (THREE.LOD).
 * No building geometry is generated here. Roads/pavement reuse the Phase 2 road tiles (07b tram road,
 * 07b without rails, 07a curb) — never 12a-cracked-road. Sky, fog and light are procedural.
 *
 * The dungeon camera, navigation, minimap, first-person weapon and combat transitions are untouched.
 */
const BASE = `${import.meta.env.BASE_URL}assets/chapter3/gyeongseong/`;
const SKY_TOP = new THREE.Color(0x6f9fd6);
const SKY_HORIZON = new THREE.Color(0xd9d2c2);
const GROUND_COLOR = 0x5d5560;
/** Buildings closer than this use the full textured FBX mesh. */
export const BUILDING_LOD_DISTANCE = 55;
/** Buildings farther than this (well inside the fog) are not drawn at all. */
export const BUILDING_CULL_DISTANCE = 185;
export const GYEONGSEONG_CAMERA_FAR = 300;
const ROAD_TILE_SCALE = CELL / 2; // road meshes were converted as 2-unit tiles

export type GyeongseongEnvironment = {
  root: THREE.Group;
  fog: THREE.Fog;
  background: THREE.Color;
  layout: GyeongseongLayout;
  ready: Promise<void>;
  update(camera: THREE.Camera): void;
  dispose(): void;
};

/** GSM1 road tiles: u32 magic, vertexCount, groupCount, hasUv | u32 groupVertexCounts[] | f32 pos | f32 normal | f32 uv? */
export function parseGsm(buffer: ArrayBuffer, groupColors?: THREE.Color[]): THREE.BufferGeometry {
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
  return geometry;
}

const pad4 = (bytes: number) => (4 - (bytes % 4)) % 4;

/** GSM2 building mesh: u32 magic, n, indexCount, bigIndex | f32 pos[n*3] | f32 uv[n*2] | i8 normal[n*3] (+pad) | u16/u32 index */
export function parseGsm2(buffer: ArrayBuffer): THREE.BufferGeometry {
  const [magic, n, indexCount, big] = new Uint32Array(buffer, 0, 4);
  if (magic !== 0x324d5347) throw new Error("not a GSM2 mesh");
  let offset = 16;
  const position = new Float32Array(buffer, offset, n * 3); offset += n * 12;
  const uv = new Float32Array(buffer, offset, n * 2); offset += n * 8;
  const normal = new Int8Array(buffer, offset, n * 3); offset += n * 3 + pad4(n * 3);
  const index = big ? new Uint32Array(buffer, offset, indexCount) : new Uint16Array(buffer, offset, indexCount);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normal, 3, true));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/** GSL1 low-detail building: u32 magic, n, indexCount, bigIndex | f32 pos | i8 normal (+pad) | u8 rgb (+pad) | index */
export function parseGsl1(buffer: ArrayBuffer): THREE.BufferGeometry {
  const [magic, n, indexCount, big] = new Uint32Array(buffer, 0, 4);
  if (magic !== 0x314c5347) throw new Error("not a GSL1 mesh");
  let offset = 16;
  const position = new Float32Array(buffer, offset, n * 3); offset += n * 12;
  const normal = new Int8Array(buffer, offset, n * 3); offset += n * 3 + pad4(n * 3);
  const color = new Uint8Array(buffer, offset, n * 3); offset += n * 3 + pad4(n * 3);
  const index = big ? new Uint32Array(buffer, offset, indexCount) : new Uint16Array(buffer, offset, indexCount);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normal, 3, true));
  geometry.setAttribute("color", new THREE.BufferAttribute(color, 3, true));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

type Manifest = Record<string, { materials: { name: string; color: string }[] }>;

/* ---------------------------------------------------------------------------------------------------------
 * Phase 3 hotfix: shared asset cache.
 *
 * Before, every dungeon entry (each floor, each return from the base camp) fetched the 5 building models
 * (full + LOD mesh + texture, ~8 MB) and the road tiles again, parsed them again and decoded the textures again.
 * Parsed geometries / textures are now kept for the session and shared by every environment. A disposed
 * environment only releases its GPU copies (geometry.dispose() / texture.dispose() free the WebGL objects of the
 * renderer that is going away; the CPU data stays and the next renderer uploads it again), so repeated entries,
 * floor changes and retries never download, parse or decode twice. `preloadGyeongseongAssets()` fills the cache
 * ahead of time (called from the base camp while the student is idle). Failed loads are not cached.
 * --------------------------------------------------------------------------------------------------------- */
type ModelAssets = { detailed: THREE.BufferGeometry; low: THREE.BufferGeometry; texture: THREE.Texture };
type TileAssets = { geometry: THREE.BufferGeometry; average: THREE.Color };
const modelCache = new Map<BuildingModelId, Promise<ModelAssets>>();
const tileCache = new Map<RoadTileId, Promise<TileAssets>>();
/** Models / tiles whose load has finished successfully (the cache also holds in-flight promises). */
const loadedAssets = new Set<string>();
let manifestCache: Promise<Manifest> | null = null;
const ALL_ROAD_TILE_IDS: readonly RoadTileId[] = ["road-paving", "road-tram", "road-curb"];

const fetchBinary = (name: string) => fetch(`${BASE}meshes/${name}.bin`).then((response) => {
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  return response.arrayBuffer();
});
/** Texture whose image is already decoded (Image.decode() runs off the main thread), so the GPU upload is the only step left. */
const fetchTexture = (name: string) => new Promise<THREE.Texture>((resolve, reject) => {
  const image = new Image();
  image.decoding = "async";
  image.onload = () => {
    const finish = () => {
      const texture = new THREE.Texture(image);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      texture.needsUpdate = true;
      resolve(texture);
    };
    if (typeof image.decode === "function") image.decode().then(finish, finish); else finish();
  };
  image.onerror = () => reject(new Error(`${name}: texture failed`));
  image.src = `${BASE}textures/${name}.jpg`;
});
const remember = <K, V>(cache: Map<K, Promise<V>>, key: K, load: () => Promise<V>): Promise<V> => {
  const cached = cache.get(key);
  if (cached) return cached;
  const promise = load();
  cache.set(key, promise);
  promise.catch(() => { if (cache.get(key) === promise) cache.delete(key); });
  return promise;
};
const loadManifest = () => {
  if (!manifestCache) {
    manifestCache = fetch(`${BASE}meshes/manifest.json`).then((response) => response.json() as Promise<Manifest>);
    manifestCache.catch(() => { manifestCache = null; });
  }
  return manifestCache;
};
const loadModelAssets = (model: BuildingModelId) => remember(modelCache, model, async () => {
  const [full, low, texture] = await Promise.all([fetchBinary(model), fetchBinary(`${model}-lod1`), fetchTexture(model)]);
  const assets = { detailed: parseGsm2(full), low: parseGsl1(low), texture };
  loadedAssets.add(`model:${model}`);
  return assets;
});
const loadTileAssets = (tile: RoadTileId) => remember(tileCache, tile, async () => {
  const [buffer, manifest] = await Promise.all([fetchBinary(tile), loadManifest()]);
  const colors = manifest[tile]?.materials.map((m) => new THREE.Color(`#${m.color}`).multiplyScalar(1.35));
  const geometry = parseGsm(buffer, colors);
  const average = new THREE.Color(0, 0, 0);
  const colorAttribute = geometry.getAttribute("color");
  for (let index = 0; index < colorAttribute.count; index += 1) {
    average.r += colorAttribute.getX(index); average.g += colorAttribute.getY(index); average.b += colorAttribute.getZ(index);
  }
  average.multiplyScalar(1 / Math.max(1, colorAttribute.count));
  loadedAssets.add(`tile:${tile}`);
  return { geometry, average };
});

/**
 * Loads (once per session) every building model and road tile a Gyeongseong street can use, one asset at a time
 * so it never competes with the base camp. Resolves when done; never rejects (a failed asset is retried on entry).
 */
export async function preloadGyeongseongAssets(models: readonly BuildingModelId[] = BUILDING_MODEL_IDS): Promise<void> {
  for (const tile of ALL_ROAD_TILE_IDS) await loadTileAssets(tile).catch(() => undefined);
  for (const model of models) await loadModelAssets(model).catch(() => undefined);
}
/** True when every street asset is already loaded (a dungeon entry then needs no loading screen at all). */
export function areGyeongseongAssetsLoaded(models: readonly BuildingModelId[] = BUILDING_MODEL_IDS): boolean {
  return ALL_ROAD_TILE_IDS.every((tile) => loadedAssets.has(`tile:${tile}`)) && models.every((model) => loadedAssets.has(`model:${model}`));
}
/** For checks / diagnostics: how many models and tiles are cached (settled or in flight). */
export function getGyeongseongAssetCacheSize() { return { models: modelCache.size, tiles: tileCache.size }; }

export function createGyeongseongEnvironment(map: DungeonMapDefinition, seed: string, profile: GyeongseongProfile = "floor1"): GyeongseongEnvironment {
  const layout = planGyeongseongLayout(map, seed, profile);
  const root = new THREE.Group();
  root.name = "GyeongseongEnvironment";
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  let disposed = false;

  /* ---- sky dome (follows the camera), light */
  const skyGeometry = new THREE.SphereGeometry(GYEONGSEONG_CAMERA_FAR * 0.9, 24, 12);
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
  const hemisphere = new THREE.HemisphereLight(0xeef2ff, 0x6a5848, 2.1);
  const sun = new THREE.DirectionalLight(0xffeccc, 1.6);
  sun.position.set(-40, 90, 30);
  root.add(hemisphere, sun);

  /* ---- ground under everything (no holes even before the tiles load) */
  const { minI, maxI, minJ, maxJ } = layout.bounds;
  const groundGeometry = new THREE.PlaneGeometry((maxI - minI + 60) * CELL, (maxJ - minJ + 60) * CELL);
  const groundMaterial = new THREE.MeshLambertMaterial({ color: GROUND_COLOR });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(((minI + maxI) / 2 + 0.5) * CELL, GROUND_Y - 0.15, ((minJ + maxJ) / 2 + 0.5) * CELL);
  root.add(ground);
  geometries.push(groundGeometry); materials.push(groundMaterial);


  /* ---- road LOD: detailed stone tiles near the camera, flat tiles farther away */
  const ROAD_LOD_RADIUS = 30;
  type TileLod = { detailed: THREE.InstancedMesh; flat: THREE.InstancedMesh; placements: typeof layout.tiles; matrices: THREE.Matrix4[] };
  const tileLods: TileLod[] = [];
  const flatTileGeometry = new THREE.PlaneGeometry(CELL, CELL);
  flatTileGeometry.rotateX(-Math.PI / 2);
  flatTileGeometry.translate(0, -0.01, 0);
  geometries.push(flatTileGeometry);

  type BuildingObject = { lod: THREE.LOD; radius: number };
  const buildingObjects: BuildingObject[] = [];
  const lastUpdate = new THREE.Vector3(Infinity, 0, 0);
  const refresh = (position: THREE.Vector3) => {
    for (const tileLod of tileLods) {
      let near = 0, far = 0;
      tileLod.placements.forEach((placement, index) => {
        const dx = placement.x - position.x, dz = placement.z - position.z;
        if (dx * dx + dz * dz < ROAD_LOD_RADIUS * ROAD_LOD_RADIUS) tileLod.detailed.setMatrixAt(near++, tileLod.matrices[index]);
        else tileLod.flat.setMatrixAt(far++, tileLod.matrices[index]);
      });
      tileLod.detailed.count = near; tileLod.flat.count = far;
      tileLod.detailed.instanceMatrix.needsUpdate = true; tileLod.flat.instanceMatrix.needsUpdate = true;
    }
    for (const building of buildingObjects) {
      const dx = building.lod.position.x - position.x, dz = building.lod.position.z - position.z;
      building.lod.visible = Math.sqrt(dx * dx + dz * dz) - building.radius < BUILDING_CULL_DISTANCE;
    }
  };

  const usedModels = [...new Set(layout.buildings.map((b) => b.model))] as BuildingModelId[];
  const usedTiles = [...new Set(layout.tiles.map((t) => t.tile))] as RoadTileId[];

  const ready = (async () => {
    await Promise.all([
      ...usedModels.map(async (model) => {
        const { detailed: detailedGeometry, low: lowGeometry, texture } = await loadModelAssets(model);
        if (disposed) return;
        const detailedMaterial = new THREE.MeshLambertMaterial({ map: texture });
        const lowMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
        // Shared (cached) geometries / texture: dispose() on unmount only frees this renderer's GPU copies.
        geometries.push(detailedGeometry, lowGeometry); materials.push(detailedMaterial, lowMaterial); textures.push(texture);
        for (const placement of layout.buildings.filter((b) => b.model === model)) {
          const lod = new THREE.LOD();
          const near = new THREE.Mesh(detailedGeometry, detailedMaterial);
          const farMesh = new THREE.Mesh(lowGeometry, lowMaterial);
          lod.addLevel(near, 0);
          lod.addLevel(farMesh, BUILDING_LOD_DISTANCE);
          lod.position.set(placement.x, GROUND_Y, placement.z);
          lod.rotation.y = placement.rotationY;
          lod.scale.set(placement.mirrored ? -placement.scale : placement.scale, placement.scale, placement.scale);
          lod.name = `building:${model}`;
          lod.userData.footprint = placement;
          root.add(lod);
          buildingObjects.push({ lod, radius: Math.max(placement.maxX - placement.minX, placement.maxZ - placement.minZ) / 2 });
        }
      }),
      ...usedTiles.map(async (tile) => {
        const { geometry, average } = await loadTileAssets(tile);
        if (disposed) return;
        const material = new THREE.MeshLambertMaterial({ vertexColors: true });
        geometries.push(geometry); materials.push(material);
        const placements = layout.tiles.filter((t) => t.tile === tile);
        const matrices = placements.map((placement) => new THREE.Matrix4().compose(
          new THREE.Vector3(placement.x, GROUND_Y, placement.z),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), placement.rotationY),
          new THREE.Vector3(ROAD_TILE_SCALE, ROAD_TILE_SCALE, ROAD_TILE_SCALE),
        ));
        const detailed = new THREE.InstancedMesh(geometry, material, placements.length);
        const flatMaterial = new THREE.MeshLambertMaterial({ color: average });
        materials.push(flatMaterial);
        const flat = new THREE.InstancedMesh(flatTileGeometry, flatMaterial, placements.length);
        [detailed, flat].forEach((mesh) => { mesh.frustumCulled = false; mesh.name = `road:${tile}`; root.add(mesh); });
        tileLods.push({ detailed, flat, placements, matrices });
      }),
    ]);
    lastUpdate.set(Infinity, 0, 0);
  })();

  return {
    root,
    layout,
    fog: new THREE.Fog(SKY_HORIZON.getHex(), 55, 190),
    background: SKY_HORIZON.clone(),
    ready,
    update: (camera) => {
      sky.position.copy(camera.position);
      const dx = camera.position.x - lastUpdate.x, dz = camera.position.z - lastUpdate.z;
      if (!(dx * dx + dz * dz < 9)) {
        lastUpdate.copy(camera.position);
        refresh(camera.position);
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

export const GYEONGSEONG_MODEL_IDS = BUILDING_MODEL_IDS;
