import type { DungeonMapDefinition, DungeonRoomNode, DungeonRoomProgress } from "../dungeon/dungeonTypes";
import { createSeededRandom } from "../dungeon/generation/seededRandom";
import { changeItemQuantity, getItemQuantity } from "../inventory/inventoryState";
import type { GameSaveState } from "../../save/saveStateAdapter";

/**
 * Unit 3 · Floor 1 — 을사늑약과 항일 의병 운동 (Hotfix 3 title; formerly 「빼앗긴 외교권, 꺼지지 않는 의지」)
 * Quest: 돌아갈 곳을 잊은 사람.
 *
 * Every story beat is persisted as a flag in `firstObjectiveEventSeen` (existing save field), so no save
 * schema/version change is needed and Unit 2 / Unit 3 Phase 1 saves load unchanged (missing flag = not seen).
 */
export const UNIT3_FLOOR1_ID = "unit3-floor-1" as const;
export const UNIT3_FLOOR1_QUEST_ID = "quest-unit3-floor-1";
export const UNIT3_FLOOR1_TITLE = "을사늑약과 항일 의병 운동";
export const UNIT3_FLOOR1_QUEST_TITLE = "돌아갈 곳을 잊은 사람";

export const UNIT3_FLOOR1_FLAGS = {
  questAccepted: "unit3-floor-1:quest-accepted",
  startEvent: "unit3-floor-1:start-event",
  cartRescue: "unit3-floor-1:cart-rescue",
  story1: "unit3-floor-1:story-1",
  story2: "unit3-floor-1:story-2",
  story3: "unit3-floor-1:story-3",
  postEventTalk: "unit3-floor-1:post-event-talk",
  finalStory: "unit3-floor-1:final-story",
  baseCampReturn: "unit3-floor-1:base-camp-return",
  questCompleted: "unit3-floor-1:quest-completed",
  hwandoUnlocked: "unit3-floor-1:hwando-unlocked",
} as const;
export type Unit3Floor1Flag = (typeof UNIT3_FLOOR1_FLAGS)[keyof typeof UNIT3_FLOOR1_FLAGS];
export const UNIT3_FLOOR1_STORY_FLAGS = [UNIT3_FLOOR1_FLAGS.story1, UNIT3_FLOOR1_FLAGS.story2, UNIT3_FLOOR1_FLAGS.story3] as const;

/** Side-branch dead-end slots of the floor templates; index i hosts story event i + 1 (visit order is free). */
export const UNIT3_FLOOR1_STORY_ROOM_IDS = ["room-story-hand-axe", "room-story-tanged-point", "room-story-pottery"] as const;

export const UNIT3_MONSTER_IDS = {
  normalA: "unit3-inked-treaty-document",
  normalB: "unit3-informant-shadow", // 표시 이름: 길을 막는 그림자 (id unchanged for save/data compatibility)
  elite: "unit3-residency-general-watcher", // 표시 이름: 봉쇄의 파수꾼
} as const;

export const UNIT3_FLOOR1_REWARD = {
  gold: 10,
  smallPotions: 2,
  weaponItemId: "weapon-uibyeong-hwando",
} as const;

export const UNIT3_FLOOR1_ACHIEVEMENT = {
  id: "achievement-unit3-first-returnee",
  title: "첫 번째 귀환자",
  description: "던전에서 자신의 이름과 가족을 잊어 가던 주민을 구출했다.",
} as const;

export type Unit3Flags = Readonly<Record<string, boolean | undefined>>;

export function hasFlag(flags: Unit3Flags, flag: string): boolean {
  return flags[flag] === true;
}

export function allStoryEventsDone(flags: Unit3Flags): boolean {
  return UNIT3_FLOOR1_STORY_FLAGS.every((flag) => hasFlag(flags, flag));
}

export function getStoryIndexForRoom(roomId: string): number {
  return (UNIT3_FLOOR1_STORY_ROOM_IDS as readonly string[]).indexOf(roomId);
}

const adjacencyOf = (map: Pick<DungeonMapDefinition, "connections">) => {
  const adjacency = new Map<string, string[]>();
  for (const connection of map.connections) {
    adjacency.set(connection.fromRoomId, [...(adjacency.get(connection.fromRoomId) ?? []), connection.toRoomId]);
    adjacency.set(connection.toRoomId, [...(adjacency.get(connection.toRoomId) ?? []), connection.fromRoomId]);
  }
  return adjacency;
};

/**
 * The cart rescue happens in the main-route room directly after the start room. Every template connects
 * the start room to exactly one room, so every other room — including all three story rooms — can only be
 * reached through it: the rescue always happens before any story room.
 */
export function findCartRoomId(map: Pick<DungeonMapDefinition, "connections" | "startRoomId">): string {
  const neighbours = adjacencyOf(map).get(map.startRoomId) ?? [];
  if (neighbours.length !== 1) throw new Error(`[unit3Floor1] start room must have exactly one exit (has ${neighbours.length})`);
  return neighbours[0];
}

function asCombat(room: DungeonRoomNode, monsterId: string): DungeonRoomNode {
  return {
    ...room,
    type: "combat",
    eliteConfig: undefined,
    eventConfig: undefined,
    combatConfig: {
      monsterId,
      questionSetId: room.combatConfig?.questionSetId ?? room.eliteConfig?.questionSetId ?? "normal-garlic-a",
      monsterPosition: room.explorationCameraPose.lookAt,
      combatCameraPose: room.explorationCameraPose,
    },
  };
}

function asElite(room: DungeonRoomNode): DungeonRoomNode {
  return {
    ...room,
    type: "elite",
    combatConfig: undefined,
    eventConfig: undefined,
    eliteConfig: {
      monsterId: UNIT3_MONSTER_IDS.elite,
      questionSetId: room.eliteConfig?.questionSetId ?? "floor1-elite-a",
      attackDamage: room.eliteConfig?.attackDamage ?? 8,
      monsterPosition: room.explorationCameraPose.lookAt,
      combatCameraPose: room.explorationCameraPose,
    },
  };
}

/**
 * Deterministic (seeded) Floor 1 layout rules on top of the shared generator:
 * - start → cart room (normal combat with 먹물 든 을사늑약 문서; mandatory, before the story rooms)
 * - the three dead-end story rooms are empty and required; their completion comes from persisted flags
 * - the final room stays a combat-free quest room
 * - at least one elite (봉쇄의 파수꾼) remains; other combat rooms get A or B
 * - only the cart room and the three story rooms gate the final room.
 */
export function prepareUnit3Floor1Map(map: DungeonMapDefinition, seed: string): DungeonMapDefinition {
  const random = createSeededRandom(`${seed}::unit3-floor-1-layout`);
  const cartRoomId = findCartRoomId(map);
  const storyIds = new Set<string>(UNIT3_FLOOR1_STORY_ROOM_IDS);
  let rooms = map.rooms.map((room): DungeonRoomNode => {
    if (storyIds.has(room.id)) {
      return { ...room, type: "empty", combatConfig: undefined, eliteConfig: undefined, eventConfig: undefined, isRequired: true };
    }
    if (room.id === cartRoomId) return { ...asCombat(room, UNIT3_MONSTER_IDS.normalA), isRequired: true };
    if (room.type === "start" || room.isFinalQuestRoom) return room;
    return { ...room, isRequired: false };
  });
  const flexible = rooms
    .filter((room) => room.id !== cartRoomId && !storyIds.has(room.id) && room.type !== "start" && !room.isFinalQuestRoom)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!rooms.some((room) => room.type === "elite")) {
    const target = flexible.find((room) => room.type === "combat") ?? flexible.find((room) => room.type === "empty") ?? flexible[0];
    if (target) rooms = rooms.map((room) => room.id === target.id ? asElite(room) : room);
  }
  rooms = rooms.map((room) => {
    if (room.type === "combat" && room.id !== cartRoomId && room.combatConfig) {
      return { ...room, combatConfig: { ...room.combatConfig, monsterId: random.next() < 0.5 ? UNIT3_MONSTER_IDS.normalA : UNIT3_MONSTER_IDS.normalB } };
    }
    if (room.type === "elite" && room.eliteConfig) {
      return { ...room, eliteConfig: { ...room.eliteConfig, monsterId: UNIT3_MONSTER_IDS.elite } };
    }
    return room;
  });
  return { ...map, rooms };
}

/** Room progress for a fresh run: persisted story beats mark their rooms as already resolved. */
export function applyUnit3Floor1Progress(
  map: DungeonMapDefinition,
  progress: Record<string, DungeonRoomProgress>,
  flags: Unit3Flags,
): Record<string, DungeonRoomProgress> {
  const next = { ...progress };
  UNIT3_FLOOR1_STORY_ROOM_IDS.forEach((roomId, index) => {
    if (map.rooms.some((room) => room.id === roomId)) {
      next[roomId] = { roomId, eventCompleted: hasFlag(flags, UNIT3_FLOOR1_STORY_FLAGS[index]) };
    }
  });
  const cartRoomId = findCartRoomId(map);
  next[cartRoomId] = { roomId: cartRoomId, eventCompleted: hasFlag(flags, UNIT3_FLOOR1_FLAGS.cartRescue) };
  next[map.startRoomId] = { roomId: map.startRoomId, eventCompleted: hasFlag(flags, UNIT3_FLOOR1_FLAGS.startEvent) };
  return next;
}

export type Unit3QuestPhase = "notAccepted" | "active" | "readyToComplete" | "completed";

export function getUnit3Floor1QuestPhase(state: Pick<GameSaveState, "questState" | "firstObjectiveEventSeen">): Unit3QuestPhase {
  const status = state.questState[UNIT3_FLOOR1_QUEST_ID];
  if (status === "completed") return "completed";
  if (status !== "active") return "notAccepted";
  return hasFlag(state.firstObjectiveEventSeen, UNIT3_FLOOR1_FLAGS.finalStory) ? "readyToComplete" : "active";
}

const withFlag = (state: GameSaveState, flag: string): GameSaveState => ({
  ...state,
  firstObjectiveEventSeen: { ...state.firstObjectiveEventSeen, [flag]: true },
});

/** ① "함께 가겠습니다." — quest accepted, Floor 1 unlocked. Idempotent. */
export function acceptUnit3Floor1Quest(state: GameSaveState): GameSaveState {
  if (state.questState[UNIT3_FLOOR1_QUEST_ID] === "active" || state.questState[UNIT3_FLOOR1_QUEST_ID] === "completed") return state;
  return withFlag({
    ...state,
    questState: { ...state.questState, [UNIT3_FLOOR1_QUEST_ID]: "active" },
    floorUnlockState: {
      unlockedFloorIds: [...new Set([...state.floorUnlockState.unlockedFloorIds, UNIT3_FLOOR1_ID])],
    },
  }, UNIT3_FLOOR1_FLAGS.questAccepted);
}

export function markUnit3Flag(state: GameSaveState, flag: string): GameSaveState {
  return hasFlag(state.firstObjectiveEventSeen, flag) ? state : withFlag(state, flag);
}

/**
 * Quest completion (Deneb, Event J). Rewards are granted exactly once: guarded by `rewardClaimed`,
 * so replays, reloads or double clicks can never duplicate gold, potions, the skin or the achievement.
 * The two small potions are added like the Unit 2 quest/NPC potion rewards (changeItemQuantity, no pouch cap).
 */
export function completeUnit3Floor1Quest(state: GameSaveState): GameSaveState {
  if (getUnit3Floor1QuestPhase(state) !== "readyToComplete" || state.rewardClaimed[UNIT3_FLOOR1_QUEST_ID]) return state;
  let inventoryState = changeItemQuantity(state.inventoryState, "potion-small", UNIT3_FLOOR1_REWARD.smallPotions);
  if (getItemQuantity(inventoryState, UNIT3_FLOOR1_REWARD.weaponItemId) === 0) {
    inventoryState = changeItemQuantity(inventoryState, UNIT3_FLOOR1_REWARD.weaponItemId, 1);
  }
  return {
    ...state,
    playerState: { ...state.playerState, gold: state.playerState.gold + UNIT3_FLOOR1_REWARD.gold },
    inventoryState,
    questState: { ...state.questState, [UNIT3_FLOOR1_QUEST_ID]: "completed" },
    rewardClaimed: { ...state.rewardClaimed, [UNIT3_FLOOR1_QUEST_ID]: true },
    achievementReceived: { ...state.achievementReceived, [UNIT3_FLOOR1_ACHIEVEMENT.id]: true },
    firstObjectiveEventSeen: {
      ...state.firstObjectiveEventSeen,
      [UNIT3_FLOOR1_FLAGS.questCompleted]: true,
      [UNIT3_FLOOR1_FLAGS.hwandoUnlocked]: true,
    },
  };
}

/** Called when the final story (Event H) ends: floor cleared, final flag saved, back to the base camp. */
export function finishUnit3Floor1Run(state: GameSaveState): GameSaveState {
  return {
    ...withFlag(state, UNIT3_FLOOR1_FLAGS.finalStory),
    currentFloorId: null,
    currentFloorRun: null,
    playerState: { ...state.playerState, currentHp: state.playerState.maxHp },
    clearedFloorIds: [...new Set([...state.clearedFloorIds, UNIT3_FLOOR1_ID])],
  };
}
