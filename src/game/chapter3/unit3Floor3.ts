import type { DungeonMapDefinition, DungeonRoomNode, DungeonRoomProgress } from "../dungeon/dungeonTypes";
import { changeItemQuantity } from "../inventory/inventoryState";
import type { GameSaveState } from "../../save/saveStateAdapter";
import { UNIT3_FLOOR1_FLAGS, UNIT3_FLOOR1_QUEST_ID, UNIT3_FLOOR1_STORY_ROOM_IDS, findCartRoomId, hasFlag, type Unit3Flags, type Unit3QuestPhase } from "./unit3Floor1";
import { UNIT3_FLOOR2_FLAGS, UNIT3_FLOOR2_ID, UNIT3_FLOOR2_QUEST_ID } from "./unit3Floor2";

/**
 * Unit 3 · Floor 3 — 일제의 식민 통치와 달라진 생활 (1910년대, 3·1 운동 이전). Quest: 잊지 않은 약속 (카이든).
 *
 * Same dungeon flow and persistence as Floors 1–2 (flags in `firstObjectiveEventSeen`, no save schema change):
 * start room (헌병이 지키는 거리, 카프) → MAIN-ROUTE STORY ROOM right after the start (조선총독부; dialogue only, no
 * fight — the start room's only exit, so it always comes before the story rooms) → three dead-end story rooms
 * in any order (검문소 옆 골목 · 농민 가족의 집 · 학교 교실 = the "조사 현황" places) → one post-event talk →
 * final room: the side-scrolling evacuation event map (scripted cutscene; no combat, no quiz, no damage) →
 * base camp. Combat rooms: 일본제국의 헌병 (the only normal monster, 2 questions) / 조선총독부 감시자 (elite, 3).
 * The final event restores 카프's memory and she joins the base camp (부지휘관).
 */
export const UNIT3_FLOOR3_ID = "unit3-floor-3" as const;
export const UNIT3_FLOOR3_QUEST_ID = "quest-unit3-floor-3";
export const UNIT3_FLOOR3_TITLE = "일제의 식민 통치와 달라진 생활";
export const UNIT3_FLOOR3_QUEST_TITLE = "잊지 않은 약속";

export const UNIT3_FLOOR3_FLAGS = {
  questAccepted: "unit3-floor-3:quest-accepted",
  startEvent: "unit3-floor-3:start-event",
  /** main-route story room (조선총독부) — dialogue only */
  midEvent: "unit3-floor-3:mid-event",
  story1: "unit3-floor-3:story-1",
  story2: "unit3-floor-3:story-2",
  story3: "unit3-floor-3:story-3",
  postEventTalk: "unit3-floor-3:post-event-talk",
  /** the evacuation event map (final room) was completed */
  finalStory: "unit3-floor-3:final-story",
  /** 카프 remembers who she is (written with finalStory) */
  kafMemoryRestored: "unit3-floor-3:kaf-memory-restored",
  /** 카프 is a base-camp NPC (written with finalStory — independent of the quest report) */
  kafJoined: "unit3-floor-3:kaf-joined",
  questCompleted: "unit3-floor-3:quest-completed",
} as const;
export const UNIT3_FLOOR3_STORY_FLAGS = [UNIT3_FLOOR3_FLAGS.story1, UNIT3_FLOOR3_FLAGS.story2, UNIT3_FLOOR3_FLAGS.story3] as const;
export const UNIT3_FLOOR3_STORY_ROOM_IDS = UNIT3_FLOOR1_STORY_ROOM_IDS;
/** "조사 현황": the three places whose safety is confirmed by story rooms 1–3. */
export const UNIT3_FLOOR3_INVESTIGATION_PLACES = ["검문소 옆 골목", "농민 가족의 집", "학교 교실"] as const;

export const UNIT3_FLOOR3_MONSTER_IDS = {
  kenpei: "unit3-f3-kenpei", // 일본제국의 헌병 (only normal monster)
  watcher: "unit3-f3-governor-watcher", // 조선총독부 감시자 (elite)
} as const;

export const UNIT3_FLOOR3_REWARD = { gold: 10, smallPotions: 2, weaponItemId: "decor-taken-land-deed" } as const;
/** Floor 3 special reward: quest completed + 7 distinct correct questions (granted with the report if met then). */
export const UNIT3_FLOOR3_SPECIAL_REWARD = { itemId: "decor-taken-land-deed", requiredCorrect: 7 } as const;
export const UNIT3_FLOOR3_ACHIEVEMENT = {
  id: "achievement-unit3-returned-vice-commander",
  title: "돌아온 부지휘관",
  description: "카프의 기억을 되찾고 베이스캠프로 함께 돌아왔다.",
} as const;

export function allFloor3StoryEventsDone(flags: Unit3Flags): boolean {
  return UNIT3_FLOOR3_STORY_FLAGS.every((flag) => hasFlag(flags, flag));
}

function asCombat(room: DungeonRoomNode): DungeonRoomNode {
  return {
    ...room, type: "combat", eliteConfig: undefined, eventConfig: undefined,
    combatConfig: {
      monsterId: UNIT3_FLOOR3_MONSTER_IDS.kenpei,
      questionSetId: room.combatConfig?.questionSetId ?? room.eliteConfig?.questionSetId ?? "normal-garlic-a",
      monsterPosition: room.explorationCameraPose.lookAt,
      combatCameraPose: room.explorationCameraPose,
    },
  };
}
function asElite(room: DungeonRoomNode): DungeonRoomNode {
  return {
    ...room, type: "elite", combatConfig: undefined, eventConfig: undefined,
    eliteConfig: {
      monsterId: UNIT3_FLOOR3_MONSTER_IDS.watcher,
      questionSetId: room.eliteConfig?.questionSetId ?? "floor1-elite-a",
      attackDamage: room.eliteConfig?.attackDamage ?? 8,
      monsterPosition: room.explorationCameraPose.lookAt,
      combatCameraPose: room.explorationCameraPose,
    },
  };
}

/**
 * Floor 1's layout rules with the Floor 3 content: the room right after the start becomes the dialogue-only
 * main-route story room (no monster); combat rooms all use the single normal monster; at least one elite room.
 * The generator itself is untouched (it never needed two normal monster types — monsters are assigned here).
 */
export function prepareUnit3Floor3Map(map: DungeonMapDefinition, _seed: string): DungeonMapDefinition {
  const midRoomId = findCartRoomId(map);
  const storyIds = new Set<string>(UNIT3_FLOOR3_STORY_ROOM_IDS);
  const dialogueOnly = (room: DungeonRoomNode): DungeonRoomNode => ({ ...room, type: "empty", combatConfig: undefined, eliteConfig: undefined, eventConfig: undefined, isRequired: true });
  let rooms = map.rooms.map((room): DungeonRoomNode => {
    if (storyIds.has(room.id) || room.id === midRoomId) return dialogueOnly(room);
    if (room.type === "start" || room.isFinalQuestRoom) return room;
    return { ...room, isRequired: false };
  });
  const flexible = rooms
    .filter((room) => room.id !== midRoomId && !storyIds.has(room.id) && room.type !== "start" && !room.isFinalQuestRoom)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!rooms.some((room) => room.type === "elite")) {
    const target = flexible.find((room) => room.type === "combat") ?? flexible.find((room) => room.type === "empty") ?? flexible[0];
    if (target) rooms = rooms.map((room) => room.id === target.id ? asElite(room) : room);
  }
  rooms = rooms.map((room) => {
    if (room.type === "combat" && room.id !== midRoomId) return asCombat(room);
    if (room.type === "elite" && room.eliteConfig) return { ...room, eliteConfig: { ...room.eliteConfig, monsterId: UNIT3_FLOOR3_MONSTER_IDS.watcher } };
    return room;
  });
  return { ...map, rooms };
}

/** Dialogue-only rooms (start, main-route story room, three story rooms) are resolved by their permanent flags. */
export function applyUnit3Floor3Progress(map: DungeonMapDefinition, progress: Record<string, DungeonRoomProgress>, flags: Unit3Flags): Record<string, DungeonRoomProgress> {
  const next = { ...progress };
  UNIT3_FLOOR3_STORY_ROOM_IDS.forEach((roomId, index) => {
    if (map.rooms.some((room) => room.id === roomId)) next[roomId] = { roomId, eventCompleted: hasFlag(flags, UNIT3_FLOOR3_STORY_FLAGS[index]) };
  });
  const midRoomId = findCartRoomId(map);
  next[midRoomId] = { roomId: midRoomId, eventCompleted: hasFlag(flags, UNIT3_FLOOR3_FLAGS.midEvent) };
  next[map.startRoomId] = { roomId: map.startRoomId, eventCompleted: hasFlag(flags, UNIT3_FLOOR3_FLAGS.startEvent) };
  return next;
}

/** Floor 3 is offered (by 카이든) once the Floor 2 quest is completed. */
export function isUnit3Floor3Available(state: Pick<GameSaveState, "questState">): boolean {
  return state.questState[UNIT3_FLOOR2_QUEST_ID] === "completed";
}

export function getUnit3Floor3QuestPhase(state: Pick<GameSaveState, "questState" | "firstObjectiveEventSeen">): Unit3QuestPhase | "locked" {
  if (!isUnit3Floor3Available(state)) return "locked";
  const status = state.questState[UNIT3_FLOOR3_QUEST_ID];
  if (status === "completed") return "completed";
  if (status !== "active") return "notAccepted";
  return hasFlag(state.firstObjectiveEventSeen, UNIT3_FLOOR3_FLAGS.finalStory) ? "readyToComplete" : "active";
}

const withFlags = (state: GameSaveState, ...flags: string[]): GameSaveState => ({
  ...state,
  firstObjectiveEventSeen: { ...state.firstObjectiveEventSeen, ...Object.fromEntries(flags.map((flag) => [flag, true])) },
});

/** ① "함께 조사하겠습니다." — quest accepted, Floor 3 unlocked. Idempotent; never before Floor 2 is completed. */
export function acceptUnit3Floor3Quest(state: GameSaveState): GameSaveState {
  if (!isUnit3Floor3Available(state)) return state;
  const status = state.questState[UNIT3_FLOOR3_QUEST_ID];
  if (status === "active" || status === "completed") return state;
  return withFlags({
    ...state,
    questState: { ...state.questState, [UNIT3_FLOOR3_QUEST_ID]: "active" },
    floorUnlockState: { unlockedFloorIds: [...new Set([...state.floorUnlockState.unlockedFloorIds, UNIT3_FLOOR3_ID])] },
  }, UNIT3_FLOOR3_FLAGS.questAccepted);
}

/** 카이든's report: gold + potions + achievement exactly once (the special item via completeUnit3QuestWithSpecialReward). */
export function completeUnit3Floor3Quest(state: GameSaveState): GameSaveState {
  if (getUnit3Floor3QuestPhase(state) !== "readyToComplete" || state.rewardClaimed[UNIT3_FLOOR3_QUEST_ID]) return state;
  const inventoryState = changeItemQuantity(state.inventoryState, "potion-small", UNIT3_FLOOR3_REWARD.smallPotions);
  return withFlags({
    ...state,
    playerState: { ...state.playerState, gold: state.playerState.gold + UNIT3_FLOOR3_REWARD.gold },
    inventoryState,
    questState: { ...state.questState, [UNIT3_FLOOR3_QUEST_ID]: "completed" },
    rewardClaimed: { ...state.rewardClaimed, [UNIT3_FLOOR3_QUEST_ID]: true },
    achievementReceived: { ...state.achievementReceived, [UNIT3_FLOOR3_ACHIEVEMENT.id]: true },
  }, UNIT3_FLOOR3_FLAGS.questCompleted);
}

/**
 * The evacuation event map ended (played or skipped): floor cleared, 카프 remembers and joins the base camp —
 * saved right here, before (and independent of) the quest report. Never replayed afterwards.
 */
export function finishUnit3Floor3Run(state: GameSaveState): GameSaveState {
  return {
    ...withFlags(state, UNIT3_FLOOR3_FLAGS.finalStory, UNIT3_FLOOR3_FLAGS.kafMemoryRestored, UNIT3_FLOOR3_FLAGS.kafJoined),
    currentFloorId: null,
    currentFloorRun: null,
    playerState: { ...state.playerState, currentHp: state.playerState.maxHp },
    clearedFloorIds: [...new Set([...state.clearedFloorIds, UNIT3_FLOOR3_ID])],
  };
}

/** 카프 is at the base camp (after the Floor 3 rescue). */
export function isKafAtBaseCamp(state: Pick<GameSaveState, "firstObjectiveEventSeen">): boolean {
  return hasFlag(state.firstObjectiveEventSeen, UNIT3_FLOOR3_FLAGS.kafJoined);
}

/**
 * The floor the student currently has to clear: the active, not yet cleared quest floor (latest first).
 * null when no floor is pending.
 */
export function getUnit3PendingFloorId(state: Pick<GameSaveState, "questState" | "firstObjectiveEventSeen">): string | null {
  if (state.questState[UNIT3_FLOOR3_QUEST_ID] === "active" && !hasFlag(state.firstObjectiveEventSeen, UNIT3_FLOOR3_FLAGS.finalStory)) return UNIT3_FLOOR3_ID;
  if (state.questState[UNIT3_FLOOR2_QUEST_ID] === "active" && !hasFlag(state.firstObjectiveEventSeen, UNIT3_FLOOR2_FLAGS.finalStory)) return UNIT3_FLOOR2_ID;
  if (state.questState[UNIT3_FLOOR1_QUEST_ID] === "active" && !hasFlag(state.firstObjectiveEventSeen, UNIT3_FLOOR1_FLAGS.finalStory)) return "unit3-floor-1";
  return null;
}
