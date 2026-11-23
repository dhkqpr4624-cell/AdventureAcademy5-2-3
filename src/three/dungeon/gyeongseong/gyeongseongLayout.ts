import type { DungeonMapDefinition } from "../../../game/dungeon/dungeonTypes";
import { createSeededRandom } from "../../../game/dungeon/generation/seededRandom";

/**
 * Pure (three-free) layout planner for the stylised 1900s Gyeongseong streets of Unit 3 Floor 1.
 *
 * The dungeon graph is kept as-is (rooms on a 16-unit grid, camera paths between room centres). The
 * world is rasterised on a 2-unit lattice:
 * - every room becomes a 10×10 plaza (5×5 cells), every connection a 6-unit-wide street (3 cells),
 *   so straights, corners, T-junctions, crossings and dead ends all follow from the graph itself;
 * - every other cell inside the bounds is closed: façades from the supplied building models line the
 *   open cells, and any closed cell a building does not cover gets a solid block, so side paths that are
 *   not part of the dungeon are visibly closed and there are no gaps to look through;
 * - placement is deterministic from the dungeon seed.
 */
export const CELL = 2;
export const PLAZA_RADIUS_CELLS = 2; // 5×5 cells = 10×10 units
export const STREET_RADIUS_CELLS = 1; // 3 cells = 6 units
export const BOUNDS_MARGIN_CELLS = 7;
export const GROUND_Y = -3;

export type BuildingModelId =
  | "timber-shop" | "brick-corner-shop" | "hanok-courtyard" | "brick-arch"
  | "railway-station" | "platform-canopy" | "school" | "newspaper-office";
export type RoadTileId = "road-paving" | "road-tram" | "road-curb";

/** Footprints (world units at scale 1) measured from the converted meshes; every façade faces +Z. */
export const BUILDING_FOOTPRINTS: Record<BuildingModelId, { width: number; depth: number; height: number; weight: number }> = {
  "timber-shop": { width: 6, depth: 4, height: 8, weight: 3 },
  "brick-corner-shop": { width: 6, depth: 6, height: 9, weight: 2 },
  "hanok-courtyard": { width: 10, depth: 8, height: 6, weight: 2 },
  "brick-arch": { width: 6, depth: 8, height: 7, weight: 2 },
  "railway-station": { width: 14, depth: 6, height: 12, weight: 1 },
  "platform-canopy": { width: 8, depth: 4, height: 6.5, weight: 1 },
  school: { width: 12, depth: 8, height: 10, weight: 1 },
  "newspaper-office": { width: 8, depth: 6, height: 7.5, weight: 2 },
};
/** Asset kept in the repository for later floors; it must never be placed on Floors 1–7. */
export const FORBIDDEN_ROAD_ASSET_FLOORS_1_TO_7 = "12a-cracked-road";

export type Dir = { dx: number; dz: number };
const DIRS: Dir[] = [{ dx: 0, dz: -1 }, { dx: 1, dz: 0 }, { dx: 0, dz: 1 }, { dx: -1, dz: 0 }];
const key = (i: number, j: number) => `${i},${j}`;

export type OpenCell = { i: number; j: number; kind: "plaza" | "street"; axis?: "x" | "z"; centerLine?: boolean; main?: boolean };
export type TilePlacement = { tile: RoadTileId; x: number; z: number; rotationY: number };
export type BuildingPlacement = { model: BuildingModelId; x: number; z: number; rotationY: number; scale: number; cells: string[] };
export type BlockPlacement = { x: number; z: number; height: number; tone: number };

export type GyeongseongLayout = {
  open: Map<string, OpenCell>;
  tiles: TilePlacement[];
  buildings: BuildingPlacement[];
  blocks: BlockPlacement[];
  bounds: { minI: number; maxI: number; minJ: number; maxJ: number };
};

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
    const from = previous.get(current)!;
    pairs.add([from, current].sort().join("|"));
  }
  return pairs;
}

export function planGyeongseongLayout(map: DungeonMapDefinition, seed: string): GyeongseongLayout {
  const random = createSeededRandom(`${seed}::gyeongseong-layout`);
  const open = new Map<string, OpenCell>();
  const roomCell = new Map(map.rooms.map((room) => [room.id, { i: Math.round(room.position.x / CELL), j: Math.round(room.position.z / CELL) }]));
  for (const cell of roomCell.values()) {
    for (let di = -PLAZA_RADIUS_CELLS; di <= PLAZA_RADIUS_CELLS; di += 1) {
      for (let dj = -PLAZA_RADIUS_CELLS; dj <= PLAZA_RADIUS_CELLS; dj += 1) {
        open.set(key(cell.i + di, cell.j + dj), { i: cell.i + di, j: cell.j + dj, kind: "plaza" });
      }
    }
  }
  const mainPairs = mainRouteRoomPairs(map);
  for (const connection of map.connections) {
    const a = roomCell.get(connection.fromRoomId)!;
    const b = roomCell.get(connection.toRoomId)!;
    const axis: "x" | "z" = a.j === b.j ? "x" : "z";
    const main = mainPairs.has([connection.fromRoomId, connection.toRoomId].sort().join("|"));
    const steps = Math.max(Math.abs(b.i - a.i), Math.abs(b.j - a.j));
    const si = Math.sign(b.i - a.i), sj = Math.sign(b.j - a.j);
    for (let step = 0; step <= steps; step += 1) {
      for (let w = -STREET_RADIUS_CELLS; w <= STREET_RADIUS_CELLS; w += 1) {
        const i = a.i + si * step + (axis === "z" ? w : 0);
        const j = a.j + sj * step + (axis === "x" ? w : 0);
        const existing = open.get(key(i, j));
        if (existing?.kind === "plaza") continue;
        open.set(key(i, j), { i, j, kind: "street", axis, centerLine: w === 0, main });
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

  /* ---- road tiles */
  const tiles: TilePlacement[] = [];
  const sortedOpen = cells.sort((p, q) => p.j - q.j || p.i - q.i);
  for (const cell of sortedOpen) {
    const closedDir = DIRS.find((dir) => !isOpen(cell.i + dir.dx, cell.j + dir.dz));
    let tile: RoadTileId = "road-paving";
    let rotationY = Math.floor(random.next() * 4) * (Math.PI / 2);
    if (closedDir) {
      // 07a's curb runs along the tile's −X edge: turn it towards the closed side.
      tile = "road-curb";
      rotationY = closedDir.dx === -1 ? 0 : closedDir.dx === 1 ? Math.PI : closedDir.dz === 1 ? Math.PI / 2 : -Math.PI / 2;
    } else if (cell.kind === "street" && cell.main && cell.centerLine) {
      // 07b's rails run along local Z.
      tile = "road-tram";
      rotationY = cell.axis === "z" ? 0 : Math.PI / 2;
    }
    tiles.push({ tile, x: cell.i * CELL, z: cell.j * CELL, rotationY });
  }

  /* ---- façades along the open area */
  const taken = new Set<string>();
  const buildings: BuildingPlacement[] = [];
  const models = Object.keys(BUILDING_FOOTPRINTS) as BuildingModelId[];
  const pickModel = (maxWidth: number, maxDepth: number): { model: BuildingModelId; scale: number } | null => {
    const candidates = models.flatMap((model) => {
      const f = BUILDING_FOOTPRINTS[model];
      const scale = Math.min(1.3, maxWidth / f.width, maxDepth / f.depth);
      return scale >= 0.6 ? [{ model, scale, weight: f.weight }] : [];
    });
    if (candidates.length === 0) return null;
    const total = candidates.reduce((sum, c) => sum + c.weight, 0);
    let roll = random.next() * total;
    for (const candidate of candidates) { roll -= candidate.weight; if (roll <= 0) return candidate; }
    return candidates[candidates.length - 1];
  };
  // Frontage cells: closed cells with an open 4-neighbour. Facing = towards that open neighbour.
  type Front = { i: number; j: number; dir: Dir };
  const fronts: Front[] = [];
  for (let j = bounds.minJ; j <= bounds.maxJ; j += 1) {
    for (let i = bounds.minI; i <= bounds.maxI; i += 1) {
      if (isOpen(i, j)) continue;
      const dirs = DIRS.filter((dir) => isOpen(i + dir.dx, j + dir.dz));
      if (dirs.length === 1) fronts.push({ i, j, dir: dirs[0] });
      // Thin separator between two open areas: face the plaza side (backs face the other side).
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
    // Collect the run along the façade line (perpendicular to the facing direction).
    const along: Dir = { dx: front.dir.dz === 0 ? 0 : 1, dz: front.dir.dz === 0 ? 1 : 0 };
    const run: Front[] = [];
    for (let step = 0; ; step += 1) {
      const candidate = { i: front.i + along.dx * step, j: front.j + along.dz * step, dir: front.dir };
      if (!frontSet.has(frontKey(candidate)) || used.has(frontKey(candidate))) break;
      run.push(candidate);
      used.add(frontKey(candidate));
    }
    let cursor = 0;
    while (cursor < run.length) {
      const remaining = run.length - cursor;
      if (remaining < 2) { cursor = run.length; break; }
      // 2–5 cells (4–10 units); avoid leaving a single cell at the end of the run
      const spans = [5, 4, 3, 2].filter((span) => span <= remaining && (remaining - span !== 1));
      const span = spans.length ? spans[Math.floor(random.next() * spans.length)] : remaining;
      const chunk = run.slice(cursor, cursor + span);
      // free depth behind the chunk (closed, untaken cells)
      let depthCells = 0;
      for (let d = 0; d < 6; d += 1) {
        const ok = chunk.every((c) => {
          const ci = c.i - c.dir.dx * d, cj = c.j - c.dir.dz * d;
          return inBounds(ci, cj) && !isOpen(ci, cj) && !taken.has(key(ci, cj));
        });
        if (!ok) break;
        depthCells = d + 1;
      }
      const choice = depthCells >= 2 ? pickModel(span * CELL, depthCells * CELL - 0.2) : null;
      if (choice) {
        const f = BUILDING_FOOTPRINTS[choice.model];
        const width = f.width * choice.scale, depth = f.depth * choice.scale;
        const first = chunk[0], last = chunk[chunk.length - 1];
        const midI = (first.i + last.i) / 2, midJ = (first.j + last.j) / 2;
        // façade line = shared edge between the frontage cells and the open cells, set back 0.1
        const frontX = midI * CELL + front.dir.dx * (CELL / 2 - 0.1);
        const frontZ = midJ * CELL + front.dir.dz * (CELL / 2 - 0.1);
        const x = frontX - front.dir.dx * depth / 2;
        const z = frontZ - front.dir.dz * depth / 2;
        const covered: string[] = [];
        const coveredDepth = Math.ceil(depth / CELL - 0.05);
        const halfWidthCells = width / CELL / 2;
        for (const c of chunk) {
          const offset = Math.abs((c.i - midI) * along.dx + (c.j - midJ) * along.dz);
          if (offset > halfWidthCells + 0.01) continue;
          for (let d = 0; d < coveredDepth; d += 1) covered.push(key(c.i - c.dir.dx * d, c.j - c.dir.dz * d));
        }
        covered.forEach((cell) => taken.add(cell));
        buildings.push({ model: choice.model, x, z, rotationY: Math.atan2(front.dir.dx, front.dir.dz), scale: choice.scale, cells: covered });
      }
      cursor += span;
    }
  }

  /* ---- solid blocks for every closed cell not covered by a building */
  const blocks: BlockPlacement[] = [];
  for (let j = bounds.minJ; j <= bounds.maxJ; j += 1) {
    for (let i = bounds.minI; i <= bounds.maxI; i += 1) {
      if (isOpen(i, j) || taken.has(key(i, j))) continue;
      const touching = DIRS.some((dir) => isOpen(i + dir.dx, j + dir.dz));
      const diagonal = !touching && [[1, 1], [1, -1], [-1, 1], [-1, -1]].some(([a, b]) => isOpen(i + a, j + b));
      // Low walls next to the street so the façades behind read as the city; taller masses only far away.
      const height = touching ? 3.4 + random.next() * 0.8 : diagonal ? 4 + random.next() * 1.4 : 4.5 + random.next() * 3.5;
      blocks.push({ x: i * CELL, z: j * CELL, height, tone: random.next() });
    }
  }
  return { open, tiles, buildings, blocks, bounds };
}
