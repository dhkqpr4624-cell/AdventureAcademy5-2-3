import type { DungeonMapDefinition, DungeonRoomNode } from "../dungeon/dungeonTypes";
import { createDungeonRun } from "../dungeon/generation/floor1DungeonRuntime";
import { resolveDungeonRoomEvent } from "../dungeon/dungeonRoomEventResolver";
import { getFloorNumber, getMonsterDamageForFloor, getWrongAnswerDamageForFloor, POTION_HEALING } from "../balance/floorBalance";
import { ELITE_COMBAT_QUESTION_COUNT } from "../combat/eliteCombatResolver";
import { changeItemQuantity, getItemQuantity, type InventoryState } from "../inventory/inventoryState";
import { getPotionMaxQuantity, SHOP_PRODUCTS } from "../inventory/shopResolver";
import type { GameSaveState } from "../../save/saveStateAdapter";
import { UNIT3_FLOOR1_STORY_ROOM_IDS, findCartRoomId, hasFlag } from "./unit3Floor1";
import { getUnit3TargetFloorId } from "./unit3Floor2";
import { getUnit3StoryFloor } from "./unit3StoryFloors";

/**
 * 보급물품 비상 지원 (Phase 3).
 *
 * A safety net so a student who has run out of both potions and gold can still attempt the current floor —
 * never a guaranteed clear and never an infinite potion source. When the supply crates are clicked:
 *
 * 1. target floor = the accepted, not yet cleared Unit 3 floor (none → no support);
 * 2. expected damage of the floor at 70 % accuracy, from the real data: the floor's own generator and layout
 *    rules (`createDungeonRun` + the floor's `prepareMap`) over a fixed set of reference seeds; per seed the
 *    reference route is the union of the shortest paths from the start room to every room the floor still
 *    requires (main-route fight, remaining story rooms, final room) — optional side rooms are not assumed;
 *    each combat room on that route is scored with the real turn rules (enemy turn after every question but
 *    the last, no turn after a perfect last answer, wrong-answer damage `getWrongAnswerDamageForFloor`,
 *    normal/elite damage `getMonsterDamageForFloor`, 2 questions normal / 3 elite), each trap room with its
 *    real wrong-answer damage; the median seed is used so the random layout does not swing the result;
 * 3. healing needed = expected damage − (current HP − 1);
 * 4. healing the student can already get = owned potions (small 20, medium 35) + the most healing the
 *    current gold can buy at shop prices within the pouch capacity;
 * 5. support only when (4) < (3): the fewest small potions covering the gap, never more than the free pouch
 *    room left after those purchases.
 *
 * Because owned potions count in (4), a second click right after a grant (or while the granted potions are
 * unused) gives nothing; a student who later spends the potions in a failed run is evaluated again from the
 * new state, so there is no permanent per-floor lockout. Grants are recorded in the save
 * (`unit3-emergency-supply:<floor>:grant-<n>` flags) next to the potions themselves.
 */
export const EMERGENCY_SUPPLY_ACCURACY = 0.7;
export const EMERGENCY_SUPPLY_REFERENCE_SEEDS = 9;
export const EMERGENCY_SUPPLY_FLAG_PREFIX = "unit3-emergency-supply:";

/** Expected damage of one fight at accuracy p with the real enemy-turn rules (criticals ignored: conservative). */
export function expectedCombatDamage(questionCount: number, attackDamage: number, wrongAnswerDamage: number, p = EMERGENCY_SUPPLY_ACCURACY): number {
  let expected = 0;
  for (let mask = 0; mask < 1 << questionCount; mask += 1) {
    const answers = Array.from({ length: questionCount }, (_, index) => (mask >> index & 1) === 1);
    const probability = answers.reduce((product, correct) => product * (correct ? p : 1 - p), 1);
    let damage = 0;
    answers.forEach((correct, index) => {
      const last = index === questionCount - 1;
      if (last && answers.every(Boolean)) return; // perfect fight: no final enemy turn
      damage += correct ? attackDamage : wrongAnswerDamage;
    });
    expected += probability * damage;
  }
  return expected;
}

function shortestPath(adjacency: Map<string, string[]>, from: string, to: string): string[] {
  const previous = new Map<string, string | null>([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const current = queue.shift()!;
    if (current === to) break;
    for (const next of adjacency.get(current) ?? []) if (!previous.has(next)) { previous.set(next, current); queue.push(next); }
  }
  if (!previous.has(to)) return [];
  const path: string[] = [];
  for (let node: string | null = to; node !== null; node = previous.get(node) ?? null) path.unshift(node);
  return path;
}

export type RouteEstimate = { seed: string; normal: number; elite: number; trap: number; expectedDamage: number };

/** Rooms of the reference route and their expected damage for one prepared floor map. */
export function estimateRouteDamage(map: DungeonMapDefinition, floorId: string, requiredRoomIds: readonly string[], seed = ""): RouteEstimate {
  const adjacency = new Map<string, string[]>();
  for (const connection of map.connections) {
    adjacency.set(connection.fromRoomId, [...(adjacency.get(connection.fromRoomId) ?? []), connection.toRoomId]);
    adjacency.set(connection.toRoomId, [...(adjacency.get(connection.toRoomId) ?? []), connection.fromRoomId]);
  }
  const route = new Set<string>();
  for (const target of requiredRoomIds) shortestPath(adjacency, map.startRoomId, target).forEach((roomId) => route.add(roomId));
  const floor = getFloorNumber(floorId);
  const wrong = getWrongAnswerDamageForFloor(floor);
  const rooms = map.rooms.filter((room) => route.has(room.id));
  const normal = rooms.filter((room) => room.type === "combat").length;
  const elite = rooms.filter((room) => room.type === "elite").length;
  const traps = rooms.filter((room) => room.type === "trap");
  const trapDamage = traps.reduce((sum, room: DungeonRoomNode) => {
    try { return sum + (1 - EMERGENCY_SUPPLY_ACCURACY) * resolveDungeonRoomEvent(room, false).damage; } catch { return sum; }
  }, 0);
  const expectedDamage = normal * expectedCombatDamage(2, getMonsterDamageForFloor(floor, "normal"), wrong)
    + elite * expectedCombatDamage(ELITE_COMBAT_QUESTION_COUNT, getMonsterDamageForFloor(floor, "elite"), wrong)
    + trapDamage;
  return { seed, normal, elite, trap: traps.length, expectedDamage };
}

/** Median reference route of the target floor for the rooms still required by the saved progress. */
export function estimateFloorDamage(state: Pick<GameSaveState, "firstObjectiveEventSeen">, floorId: string): RouteEstimate | null {
  const floor = getUnit3StoryFloor(floorId);
  if (!floor) return null;
  const flags = state.firstObjectiveEventSeen;
  const estimates: RouteEstimate[] = [];
  for (let index = 0; index < EMERGENCY_SUPPLY_REFERENCE_SEEDS; index += 1) {
    const seed = `emergency-reference-${floorId}-${index}`;
    const run = createDungeonRun(floorId as Parameters<typeof createDungeonRun>[0], seed);
    const map = floor.prepareMap(run.map, seed);
    const final = map.rooms.find((room) => room.isFinalQuestRoom);
    const required = [
      findCartRoomId(map),
      ...floor.storyFlags.flatMap((flag, storyIndex) => hasFlag(flags, flag) ? [] : [UNIT3_FLOOR1_STORY_ROOM_IDS[storyIndex]]),
      ...(final ? [final.id] : []),
    ].filter((roomId) => map.rooms.some((room) => room.id === roomId));
    estimates.push(estimateRouteDamage(map, floorId, required, seed));
  }
  estimates.sort((a, b) => a.expectedDamage - b.expectedDamage);
  return estimates[Math.floor(estimates.length / 2)];
}

export type EmergencySupplyDecision = {
  floorId: string | null;
  route: RouteEstimate | null;
  neededHealing: number;
  ownedHealing: number;
  buyableHealing: number;
  freeSmallSlots: number;
  grant: number;
};

const priceOf = (itemId: string) => SHOP_PRODUCTS.find((product) => product.itemId === itemId)!.price;

/** Healing the current gold can buy within the pouch room (small potions first; same healing per gold). */
function buyableHealing(inventory: InventoryState, gold: number) {
  let money = Math.max(0, Math.floor(gold));
  const smallRoom = Math.max(0, getPotionMaxQuantity(inventory, "potion-small") - getItemQuantity(inventory, "potion-small"));
  const smallBuy = Math.min(smallRoom, Math.floor(money / priceOf("potion-small")));
  money -= smallBuy * priceOf("potion-small");
  const mediumRoom = Math.max(0, getPotionMaxQuantity(inventory, "potion-medium") - getItemQuantity(inventory, "potion-medium"));
  const mediumBuy = Math.min(mediumRoom, Math.floor(money / priceOf("potion-medium")));
  return { healing: smallBuy * POTION_HEALING.small + mediumBuy * POTION_HEALING.medium, smallRoomLeft: smallRoom - smallBuy };
}

export function evaluateEmergencySupply(state: Pick<GameSaveState, "questState" | "firstObjectiveEventSeen" | "inventoryState" | "playerState">): EmergencySupplyDecision {
  const floorId = getUnit3TargetFloorId(state);
  const none = { floorId, route: null, neededHealing: 0, ownedHealing: 0, buyableHealing: 0, freeSmallSlots: 0, grant: 0 };
  if (!floorId) return none;
  const route = estimateFloorDamage(state, floorId);
  if (!route) return none;
  const inventory = state.inventoryState;
  const neededHealing = Math.max(0, Math.ceil(route.expectedDamage - (state.playerState.currentHp - 1)));
  const ownedHealing = getItemQuantity(inventory, "potion-small") * POTION_HEALING.small + getItemQuantity(inventory, "potion-medium") * POTION_HEALING.medium;
  const buy = buyableHealing(inventory, state.playerState.gold);
  const gap = neededHealing - ownedHealing - buy.healing;
  const grant = gap > 0 ? Math.min(buy.smallRoomLeft, Math.ceil(gap / POTION_HEALING.small)) : 0;
  return { floorId, route, neededHealing, ownedHealing, buyableHealing: buy.healing, freeSmallSlots: buy.smallRoomLeft, grant: Math.max(0, grant) };
}

/**
 * Applies the support (re-evaluated against the latest state, so a stale or repeated call grants nothing).
 * Returns the new state and the number of small potions actually given.
 */
export function applyEmergencySupply<T extends Pick<GameSaveState, "questState" | "firstObjectiveEventSeen" | "inventoryState" | "playerState">>(state: T): { state: T; granted: number } {
  const decision = evaluateEmergencySupply(state);
  if (!decision.floorId || decision.grant <= 0) return { state, granted: 0 };
  const prefix = `${EMERGENCY_SUPPLY_FLAG_PREFIX}${decision.floorId}:grant-`;
  const count = Object.keys(state.firstObjectiveEventSeen).filter((key) => key.startsWith(prefix)).length;
  return {
    granted: decision.grant,
    state: {
      ...state,
      inventoryState: changeItemQuantity(state.inventoryState, "potion-small", decision.grant),
      firstObjectiveEventSeen: { ...state.firstObjectiveEventSeen, [`${prefix}${count + 1}`]: true },
    },
  };
}
