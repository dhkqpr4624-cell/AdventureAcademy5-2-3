import type { DungeonMapDefinition, DungeonRoomNode, DungeonVector3 } from "../../../game/dungeon/dungeonTypes";
import { createSeededRandom } from "../../../game/dungeon/generation/seededRandom";

/**
 * Pure (three-free) layout planner for the stylised 1900s Gyeongseong streets of Unit 3 Floor 1.
 *
 * Logical vs visual: the dungeon graph (room ids, connections, room types, events, gates) is never touched.
 * `toGyeongseongVisualMap` only spreads the room *positions* apart by GYEONGSEONG_WORLD_SCALE so the wide
 * streets and the large buildings fit between the rooms; camera → monster offsets keep their original
 * length, so combat framing is unchanged.
 *
 * The visual world is rasterised on a 3-unit lattice:
 * - every room becomes a 24×24 plaza (8×8 cells), every connection an 18-unit-wide street (6 cells);
 *   straights, corners, T-junctions, crossings and dead ends follow from the graph itself;
 * - every other cell is closed and is filled with the supplied FBX buildings only (no generated boxes):
 *   façades line the open cells, and remaining space is filled with further FBX buildings set back from
 *   the street, so side paths that are not part of the dungeon are closed off by houses;
 * - the placement is deterministic from the dungeon seed.
 */
export const GYEONGSEONG_WORLD_SCALE = 3;
export const CELL = 3;
export const PLAZA_HALF_CELLS = 4; // 8 cells = 24 units
export const STREET_HALF_CELLS = 3; // 6 cells = 18 units (Phase 2: 6 units)
export const BOUNDS_MARGIN_CELLS = 9;
export const GROUND_Y = -3;

export type BuildingModelId = "gs-timber-shop" | "gs-brick-corner" | "gs-hanok" | "gs-station" | "gs-mansion";
export type RoadTileId = "road-paving" | "road-tram" | "road-curb";

/**
 * Footprints of the converted meshes (normalised to height 1, façade towards +Z) and the display height
 * chosen per model. Each model gets its own height because the sources have different proportions; the
 * resulting size is ≈ 2.5× the Phase 2 buildings (which were 6–12 units tall/wide).
 */
export const BUILDING_MODELS: Record<BuildingModelId, { width: number; depth: number; height: number; weight: number }> = {
  "gs-timber-shop": { width: 0.726, depth: 0.584, height: 20, weight: 3 },
  "gs-brick-corner": { width: 0.757, depth: 0.744, height: 22, weight: 3 },
  "gs-hanok": { width: 1.222, depth: 1.204, height: 14, weight: 2 },
  "gs-station": { width: 1.008, depth: 0.52, height: 27, weight: 1 },
  "gs-mansion": { width: 1.145, depth: 0.809, height: 19, weight: 2 },
};
export const BUILDING_MODEL_IDS = Object.keys(BUILDING_MODELS) as BuildingModelId[];
/** Asset kept in the repository for later floors; it must never be placed on Floors 1–7. */
export const FORBIDDEN_ROAD_ASSET_FLOORS_1_TO_7 = "12a-cracked-road";

export type Dir = { dx: number; dz: number };
const DIRS: Dir[] = [{ dx: 0, dz: -1 }, { dx: 1, dz: 0 }, { dx: 0, dz: 1 }, { dx: -1, dz: 0 }];
const key = (i: number, j: number) => `${i},${j}`;
/** Cell index containing world coordinate v (cell i spans [i·CELL, (i+1)·CELL)). */
export const cellOf = (v: number) => Math.floor(v / CELL);

export type OpenCell = { i: number; j: number; kind: "plaza" | "street"; axis?: "x" | "z"; centerLine?: boolean; main?: boolean };
export type TilePlacement = { tile: RoadTileId; x: number; z: number; rotationY: number };
export type BuildingPlacement = {
  model: BuildingModelId; x: number; z: number; rotationY: number; scale: number; mirrored: boolean;
  /** world-space footprint rectangle (axis aligned) */
  minX: number; maxX: number; minZ: number; maxZ: number; height: number; cells: string[]; frontage: boolean;
};

export type GyeongseongLayout = {
  open: Map<string, OpenCell>;
  tiles: TilePlacement[];
  buildings: BuildingPlacement[];
  bounds: { minI: number; maxI: number; minJ: number; maxJ: number };
};

/* ------------------------------------------------------------------ visual map (positions only) */
const spread = (v: DungeonVector3, center: { x: number; z: number }, next: { x: number; z: number }): DungeonVector3 =>
  [next.x + (v[0] - center.x), v[1], next.z + (v[2] - center.z)];

/**
 * Returns the same dungeon with room positions multiplied by GYEONGSEONG_WORLD_SCALE (x/z). Ids, types,
 * connections, events and requirement flags are copied unchanged; camera/monster poses move with their
 * room and keep their offsets; corridor camera paths are recomputed as the same lerps between the moved
 * room cameras.
 */
export function toGyeongseongVisualMap(map: DungeonMapDefinition, scale = GYEONGSEONG_WORLD_SCALE): DungeonMapDefinition {
  const moved = new Map<string, DungeonRoomNode>();
  for (const room of map.rooms) {
    const center = { x: room.position.x, z: room.position.z };
    const next = { x: room.position.x * scale, z: room.position.z * scale };
    const pose = (p: { position: DungeonVector3; lookAt: DungeonVector3 }) => ({ position: spread(p.position, center, next), lookAt: spread(p.lookAt, center, next) });
    moved.set(room.id, {
      ...room,
      position: { ...room.position, x: next.x, z: next.z },
      explorationCameraPose: pose(room.explorationCameraPose),
      combatConfig: room.combatConfig && { ...room.combatConfig, monsterPosition: spread(room.combatConfig.monsterPosition, center, next), combatCameraPose: pose(room.combatConfig.combatCameraPose) },
      eliteConfig: room.eliteConfig && { ...room.eliteConfig, monsterPosition: spread(room.eliteConfig.monsterPosition, center, next), combatCameraPose: pose(room.eliteConfig.combatCameraPose) },
    });
  }
  const connections = map.connections.map((connection) => {
    const fromOld = map.rooms.find((room) => room.id === connection.fromRoomId)!.explorationCameraPose.position;
    const toOld = map.rooms.find((room) => room.id === connection.toRoomId)!.explorationCameraPose.position;
    const fromNew = moved.get(connection.fromRoomId)!.explorationCameraPose.position;
    const toNew = moved.get(connection.toRoomId)!.explorationCameraPose.position;
    const remap = (p: DungeonVector3): DungeonVector3 => {
      // express p as a lerp between the old room cameras and re-apply it between the new ones
      const lengthSq = (toOld[0] - fromOld[0]) ** 2 + (toOld[2] - fromOld[2]) ** 2;
      const t = lengthSq === 0 ? 0 : ((p[0] - fromOld[0]) * (toOld[0] - fromOld[0]) + (p[2] - fromOld[2]) * (toOld[2] - fromOld[2])) / lengthSq;
      return [fromNew[0] + (toNew[0] - fromNew[0]) * t, p[1], fromNew[2] + (toNew[2] - fromNew[2]) * t];
    };
    return {
      ...connection,
      cameraPath: connection.cameraPath.map((point) => ({
        ...point,
        position: remap(point.position),
        // path look-at targets belong to the destination room: keep their offset from its camera
        lookAt: point.lookAt && [toNew[0] + (point.lookAt[0] - toOld[0]), point.lookAt[1], toNew[2] + (point.lookAt[2] - toOld[2])] as DungeonVector3,
      })),
    };
  });
  return { ...map, rooms: map.rooms.map((room) => moved.get(room.id)!), connections };
}

/* ------------------------------------------------------------------ layout */
function mainRouteRoomPairs(map: DungeonMapDefinition): Set<string> {
  const final = map.rooms.find((room) => room.isFinalQuestRoom)?.id;
  const adjacency = new Map<string, string[]>();
  map.connections.forEach((c) => {
    adjacency.set(c.fromRoomId, [...(adjacency.get(c.fromRoomId) ?? []), c.toRoomId]);
    adjacency.set(c.toRoomId, [...(adjacency.get(c.toRoomId) ?? []), c.fromRoomId]);
  });
  const previous = new Map<string, string>();
  const queue = [map.startRoomId];
  const seen = new Set(queue);
  for (let index = 0; index < queue.length; index += 1) {
    for (const next of adjacency.get(queue[index]) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next); previous.set(next, queue[index]); queue.push(next);
    }
  }
  const pairs = new Set<string>();
  for (let current = final; current && previous.has(current); current = previous.get(current)) {
    pairs.add([previous.get(current)!, current].sort().join("|"));
  }
  return pairs;
}

/** `map` must be the visual map (toGyeongseongVisualMap). */
export function planGyeongseongLayout(map: DungeonMapDefinition, seed: string): GyeongseongLayout {
  const random = createSeededRandom(`${seed}::gyeongseong-layout-v2`);
  const open = new Map<string, OpenCell>();
  // room centres sit on cell corners: plaza cells [c-PLAZA_HALF, c+PLAZA_HALF-1]
  const roomCorner = new Map(map.rooms.map((room) => [room.id, { i: Math.round(room.position.x / CELL), j: Math.round(room.position.z / CELL) }]));
  for (const c of roomCorner.values()) {
    for (let i = c.i - PLAZA_HALF_CELLS; i < c.i + PLAZA_HALF_CELLS; i += 1) {
      for (let j = c.j - PLAZA_HALF_CELLS; j < c.j + PLAZA_HALF_CELLS; j += 1) open.set(key(i, j), { i, j, kind: "plaza" });
    }
  }
  const mainPairs = mainRouteRoomPairs(map);
  for (const connection of map.connections) {
    const a = roomCorner.get(connection.fromRoomId)!;
    const b = roomCorner.get(connection.toRoomId)!;
    const axis: "x" | "z" = a.j === b.j ? "x" : "z";
    const main = mainPairs.has([connection.fromRoomId, connection.toRoomId].sort().join("|"));
    const [i0, i1] = axis === "x" ? [Math.min(a.i, b.i), Math.max(a.i, b.i)] : [a.i - STREET_HALF_CELLS, a.i + STREET_HALF_CELLS];
    const [j0, j1] = axis === "z" ? [Math.min(a.j, b.j), Math.max(a.j, b.j)] : [a.j - STREET_HALF_CELLS, a.j + STREET_HALF_CELLS];
    for (let i = i0; i < i1; i += 1) {
      for (let j = j0; j < j1; j += 1) {
        if (open.get(key(i, j))?.kind === "plaza") continue;
        const across = axis === "x" ? j - a.j : i - a.i; // −3..2
        open.set(key(i, j), { i, j, kind: "street", axis, centerLine: across === -1 || across === 0, main });
      }
    }
  }
  const cells = [...open.values()];
  const bounds = {
    minI: Math.min(...cells.map((c) => c.i)) - BOUNDS_MARGIN_CELLS,
    maxI: Math.max(...cells.map((c) => c.i)) + BOUNDS_MARGIN_CELLS,
    minJ: Math.min(...cells.map((c) => c.j)) - BOUNDS_MARGIN_CELLS,
    maxJ: Math.max(...cells.map((c) => c.j)) + BOUNDS_MARGIN_CELLS,
  };
  const isOpen = (i: number, j: number) => open.has(key(i, j));
  const inBounds = (i: number, j: number) => i >= bounds.minI && i <= bounds.maxI && j >= bounds.minJ && j <= bounds.maxJ;

  /* ---- road tiles (one 3×3 tile per open cell; no gaps) */
  const tiles: TilePlacement[] = [];
  for (const cell of cells.sort((p, q) => p.j - q.j || p.i - q.i)) {
    const closedDir = DIRS.find((dir) => !isOpen(cell.i + dir.dx, cell.j + dir.dz));
    let tile: RoadTileId = "road-paving";
    let rotationY = Math.floor(random.next() * 4) * (Math.PI / 2);
    if (closedDir) {
      // 07a's curb (pavement edge) runs along the tile's −X edge: turn it towards the buildings.
      tile = "road-curb";
      rotationY = closedDir.dx === -1 ? 0 : closedDir.dx === 1 ? Math.PI : closedDir.dz === 1 ? Math.PI / 2 : -Math.PI / 2;
    } else if (cell.kind === "street" && cell.main && cell.centerLine) {
      tile = "road-tram"; // rails run along local Z
      rotationY = cell.axis === "z" ? 0 : Math.PI / 2;
    }
    tiles.push({ tile, x: (cell.i + 0.5) * CELL, z: (cell.j + 0.5) * CELL, rotationY });
  }

  /* ---- buildings */
  const taken = new Set<string>();
  const buildings: BuildingPlacement[] = [];
  const cellsOfRect = (minX: number, maxX: number, minZ: number, maxZ: number) => {
    const out: string[] = [];
    for (let i = cellOf(minX + 0.01); i <= cellOf(maxX - 0.01); i += 1) for (let j = cellOf(minZ + 0.01); j <= cellOf(maxZ - 0.01); j += 1) out.push(key(i, j));
    return out;
  };
  const rectFree = (minX: number, maxX: number, minZ: number, maxZ: number) => cellsOfRect(minX, maxX, minZ, maxZ).every((k) => {
    const [i, j] = k.split(",").map(Number);
    return inBounds(i, j) && !isOpen(i, j) && !taken.has(k);
  });
  const pickModels = () => {
    // weighted shuffle
    const pool = BUILDING_MODEL_IDS.flatMap((id) => Array.from({ length: BUILDING_MODELS[id].weight }, () => id));
    const order: BuildingModelId[] = [];
    while (pool.length) { const index = Math.floor(random.next() * pool.length); const id = pool.splice(index, 1)[0]; if (!order.includes(id)) order.push(id); }
    return order;
  };
  /**
   * Try to place a building whose façade lies on the line `front` (world coordinate along the facing axis)
   * facing `dir`, starting at `start` along the run axis, with at most `maxAlong` units of frontage.
   */
  const tryPlace = (dir: Dir, front: number, start: number, maxAlong: number, frontage: boolean): BuildingPlacement | null => {
    for (const model of pickModels()) {
      const spec = BUILDING_MODELS[model];
      for (const variation of [1 + (random.next() - 0.5) * 0.16, 0.9, 0.8, 0.7, 0.62]) {
        const scale = spec.height * variation;
        const width = spec.width * scale, depth = spec.depth * scale;
        if (width > maxAlong + 0.01) continue;
        const setback = frontage ? 0.4 + random.next() * 1.2 : 0.4;
        const alongMin = start + Math.max(0, (Math.min(maxAlong, width + 3) - width)) * random.next() * 0.5;
        const facePos = front - (dir.dx + dir.dz) * setback; // façade plane, set back into the closed side
        const backPos = facePos - (dir.dx + dir.dz) * depth;
        const [minA, maxA] = [alongMin, alongMin + width];
        const [minF, maxF] = [Math.min(facePos, backPos), Math.max(facePos, backPos)];
        const rect = dir.dx !== 0 ? { minX: minF, maxX: maxF, minZ: minA, maxZ: maxA } : { minX: minA, maxX: maxA, minZ: minF, maxZ: maxF };
        if (!rectFree(rect.minX, rect.maxX, rect.minZ, rect.maxZ)) continue;
        const placement: BuildingPlacement = {
          model, scale, mirrored: random.next() < 0.35, frontage,
          x: (rect.minX + rect.maxX) / 2, z: (rect.minZ + rect.maxZ) / 2,
          rotationY: Math.atan2(dir.dx, dir.dz), height: scale, ...rect, cells: cellsOfRect(rect.minX, rect.maxX, rect.minZ, rect.maxZ),
        };
        placement.cells.forEach((cell) => taken.add(cell));
        buildings.push(placement);
        return placement;
      }
    }
    return null;
  };

  // Pass 1 — façades: walk every closed cell row/column bordering the open area.
  type Front = { i: number; j: number; dir: Dir };
  const fronts: Front[] = [];
  for (let j = bounds.minJ; j <= bounds.maxJ; j += 1) {
    for (let i = bounds.minI; i <= bounds.maxI; i += 1) {
      if (isOpen(i, j)) continue;
      const dirs = DIRS.filter((dir) => isOpen(i + dir.dx, j + dir.dz));
      if (dirs.length === 1) fronts.push({ i, j, dir: dirs[0] });
      else if (dirs.length === 2 && dirs[0].dx === -dirs[1].dx && dirs[0].dz === -dirs[1].dz) {
        const plazaSide = dirs.find((dir) => open.get(key(i + dir.dx, j + dir.dz))?.kind === "plaza");
        fronts.push({ i, j, dir: plazaSide ?? dirs[0] });
      }
    }
  }
  const frontKey = (f: Front) => `${f.i},${f.j},${f.dir.dx},${f.dir.dz}`;
  const frontSet = new Set(fronts.map(frontKey));
  const used = new Set<string>();
  for (const front of fronts) {
    if (used.has(frontKey(front))) continue;
    const along: Dir = { dx: front.dir.dz === 0 ? 0 : 1, dz: front.dir.dz === 0 ? 1 : 0 };
    const run: Front[] = [];
    for (let step = 0; ; step += 1) {
      const candidate = { i: front.i + along.dx * step, j: front.j + along.dz * step, dir: front.dir };
      if (!frontSet.has(frontKey(candidate)) || used.has(frontKey(candidate))) break;
      run.push(candidate); used.add(frontKey(candidate));
    }
    // façade line: the edge between these closed cells and the open cells
    const faceLine = front.dir.dx !== 0
      ? (front.i + (front.dir.dx > 0 ? 1 : 0)) * CELL
      : (front.j + (front.dir.dz > 0 ? 1 : 0)) * CELL;
    // let façades overhang the run ends a little into neighbouring closed cells (corners)
    let cursor = (along.dx ? run[0].i : run[0].j) * CELL - 2 * CELL;
    const end = ((along.dx ? run[run.length - 1].i : run[run.length - 1].j) + 1) * CELL + 2 * CELL;
    let misses = 0;
    while (end - cursor > 6 && misses < 12) {
      const placed = tryPlace(front.dir, faceLine, cursor, end - cursor, true);
      if (placed) { cursor = (along.dx ? placed.maxX : placed.maxZ) + random.next() * 0.6; misses = 0; }
      else { cursor += CELL; misses += 1; }
    }
  }
  // Pass 2 — fill the remaining closed space (gaps behind/between façades, outer ring) with further FBX
  // buildings, each facing the nearest open direction, so no empty ground or world edge shows through.
  // Only the band visible from the streets is filled (deeper blocks are hidden behind the façades and fog).
  const FILL_DEPTH_CELLS = 7;
  for (let j = bounds.minJ; j <= bounds.maxJ; j += 2) {
    for (let i = bounds.minI; i <= bounds.maxI; i += 2) {
      if (isOpen(i, j) || taken.has(key(i, j))) continue;
      const distance = (d: Dir) => { for (let s = 1; s <= FILL_DEPTH_CELLS; s += 1) if (isOpen(i + d.dx * s, j + d.dz * s)) return s; return 99; };
      const dir = [...DIRS].sort((p, q) => distance(p) - distance(q))[0];
      if (distance(dir) === 99) continue;
      const along = dir.dz === 0 ? j : i;
      const facing = dir.dx !== 0 ? (i + (dir.dx > 0 ? 1 : 0)) * CELL : (j + (dir.dz > 0 ? 1 : 0)) * CELL;
      tryPlace(dir, facing + (dir.dx + dir.dz) * 0.4, along * CELL, 40, false);
    }
  }
  // Pavement continues under every uncovered closed cell near the streets (forecourts, gaps between
  // houses), so the road, the pavement and the building plots join without bare ground.
  for (let j = bounds.minJ; j <= bounds.maxJ; j += 1) {
    for (let i = bounds.minI; i <= bounds.maxI; i += 1) {
      if (isOpen(i, j) || taken.has(key(i, j))) continue;
      let near = false;
      for (let d = -FILL_DEPTH_CELLS; d <= FILL_DEPTH_CELLS && !near; d += 1) near = isOpen(i + d, j) || isOpen(i, j + d);
      if (near) tiles.push({ tile: "road-paving", x: (i + 0.5) * CELL, z: (j + 0.5) * CELL, rotationY: Math.floor(random.next() * 4) * (Math.PI / 2) });
    }
  }
  return { open, tiles, buildings, bounds };
}
