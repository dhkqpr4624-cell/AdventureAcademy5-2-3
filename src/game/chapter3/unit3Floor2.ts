import type { DungeonMapDefinition, DungeonRoomNode, DungeonRoomProgress } from "../dungeon/dungeonTypes";
import { createSeededRandom } from "../dungeon/generation/seededRandom";
import { changeItemQuantity } from "../inventory/inventoryState";
import type { GameSaveState } from "../../save/saveStateAdapter";
import { UNIT3_FLOOR1_FLAGS, UNIT3_FLOOR1_QUEST_ID, UNIT3_FLOOR1_STORY_ROOM_IDS, findCartRoomId, hasFlag, type Unit3Flags, type Unit3QuestPhase } from "./unit3Floor1";

/**
 * Unit 3 · Floor 2 — 일제 침략에 맞선 다양한 노력(애국계몽운동과 의거 활동). Quest: 우리를 잊은 동료.
 *
 * Same structure and persistence as Floor 1 (flags in `firstObjectiveEventSeen`, no save schema change):
 * start room (카프 발견) → main-route school fight (아부쟁이 친일파, mandatory, before the story rooms) →
 * three dead-end story rooms in any order → one post-event talk → combat-free final room (학교 마당).
 * Completing the quest means 카프's place and state were confirmed — she is NOT rescued, does not regain her
 * memory, never joins the party permanently and never appears at the base camp.
 */
export const UNIT3_FLOOR2_ID = "unit3-floor-2" as const;
export const UNIT3_FLOOR2_QUEST_ID = "quest-unit3-floor-2";
export const UNIT3_FLOOR2_TITLE = "일제 침략에 맞선 다양한 노력(애국계몽운동과 의거 활동)";
export const UNIT3_FLOOR2_QUEST_TITLE = "우리를 잊은 동료";

export const UNIT3_FLOOR2_FLAGS = {
  questAccepted: "unit3-floor-2:quest-accepted",
  startEvent: "unit3-floor-2:start-event",
  schoolBattle: "unit3-floor-2:school-battle",
  story1: "unit3-floor-2:story-1",
  story2: "unit3-floor-2:story-2",
  story3: "unit3-floor-2:story-3",
  postEventTalk: "unit3-floor-2:post-event-talk",
  finalStory: "unit3-floor-2:final-story",
  /** 카프 stays at the school (written with the final story; she never joins the base camp). */
  kafStaysAtSchool: "unit3-floor-2:kaf-stays-at-school",
  questCompleted: "unit3-floor-2:quest-completed",
  penUnlocked: "unit3-floor-2:fountain-pen-unlocked",
} as const;
export const UNIT3_FLOOR2_STORY_FLAGS = [UNIT3_FLOOR2_FLAGS.story1, UNIT3_FLOOR2_FLAGS.story2, UNIT3_FLOOR2_FLAGS.story3] as const;
/** Floor 2 uses the same generator templates, hence the same dead-end story slots as Floor 1. */
export const UNIT3_FLOOR2_STORY_ROOM_IDS = UNIT3_FLOOR1_STORY_ROOM_IDS;

export const UNIT3_FLOOR2_MONSTER_IDS = {
  sycophant: "unit3-f2-sycophant", // 아부쟁이 친일파 (school fight + normal rooms)
  informer: "unit3-f2-informing-shadow", // 밀고하는 그림자
  elite: "unit3-f2-ito-phantom", // 이토 히로부미의 망령 (던전이 만든 환영)
} as const;

export const UNIT3_FLOOR2_REWARD = { gold: 10, smallPotions: 2, weaponItemId: "weapon-learning-fountain-pen" } as const;
/** Floor 2 special reward (achievement window; Phase 3 hotfix): quest completed + 7 distinct correct questions. */
export const UNIT3_FLOOR2_SPECIAL_REWARD = { itemId: "weapon-learning-fountain-pen", requiredCorrect: 7 } as const;
export const UNIT3_FLOOR2_ACHIEVEMENT = {
  id: "achievement-unit3-unforgotten-heart",
  title: "잊혀도 남은 마음",
  description: "기억을 잃고도 사람들을 지키고 있던 카프를 만났다.",
} as const;

export function allFloor2StoryEventsDone(flags: Unit3Flags): boolean {
  return UNIT3_FLOOR2_STORY_FLAGS.every((flag) => hasFlag(flags, flag));
}

function asCombat(room: DungeonRoomNode, monsterId: string): DungeonRoomNode {
  return {
    ...room, type: "combat", eliteConfig: undefined, eventConfig: undefined,
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
    ...room, type: "elite", combatConfig: undefined, eventConfig: undefined,
    eliteConfig: {
      monsterId: UNIT3_FLOOR2_MONSTER_IDS.elite,
      questionSetId: room.eliteConfig?.questionSetId ?? "floor1-elite-a",
      attackDamage: room.eliteConfig?.attackDamage ?? 8,
      monsterPosition: room.explorationCameraPose.lookAt,
      combatCameraPose: room.explorationCameraPose,
    },
  };
}

/** Floor 1's layout rules with the Floor 2 monsters (school fight in the room right after the start). */
export function prepareUnit3Floor2Map(map: DungeonMapDefinition, seed: string): DungeonMapDefinition {
  const random = createSeededRandom(`${seed}::unit3-floor-2-layout`);
  const schoolRoomId = findCartRoomId(map);
  const storyIds = new Set<string>(UNIT3_FLOOR2_STORY_ROOM_IDS);
  let rooms = map.rooms.map((room): DungeonRoomNode => {
    if (storyIds.has(room.id)) return { ...room, type: "empty", combatConfig: undefined, eliteConfig: undefined, eventConfig: undefined, isRequired: true };
    if (room.id === schoolRoomId) return { ...asCombat(room, UNIT3_FLOOR2_MONSTER_IDS.sycophant), isRequired: true };
    if (room.type === "start" || room.isFinalQuestRoom) return room;
    return { ...room, isRequired: false };
  });
  const flexible = rooms
    .filter((room) => room.id !== schoolRoomId && !storyIds.has(room.id) && room.type !== "start" && !room.isFinalQuestRoom)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!rooms.some((room) => room.type === "elite")) {
    const target = flexible.find((room) => room.type === "combat") ?? flexible.find((room) => room.type === "empty") ?? flexible[0];
    if (target) rooms = rooms.map((room) => room.id === target.id ? asElite(room) : room);
  }
  rooms = rooms.map((room) => {
    if (room.type === "combat" && room.id !== schoolRoomId && room.combatConfig) {
      return { ...room, combatConfig: { ...room.combatConfig, monsterId: random.next() < 0.5 ? UNIT3_FLOOR2_MONSTER_IDS.sycophant : UNIT3_FLOOR2_MONSTER_IDS.informer } };
    }
    if (room.type === "elite" && room.eliteConfig) return { ...room, eliteConfig: { ...room.eliteConfig, monsterId: UNIT3_FLOOR2_MONSTER_IDS.elite } };
    return room;
  });
  return { ...map, rooms };
}

export function applyUnit3Floor2Progress(map: DungeonMapDefinition, progress: Record<string, DungeonRoomProgress>, flags: Unit3Flags): Record<string, DungeonRoomProgress> {
  const next = { ...progress };
  UNIT3_FLOOR2_STORY_ROOM_IDS.forEach((roomId, index) => {
    if (map.rooms.some((room) => room.id === roomId)) next[roomId] = { roomId, eventCompleted: hasFlag(flags, UNIT3_FLOOR2_STORY_FLAGS[index]) };
  });
  // Phase 3 hotfix: the school room (story → fight → talk) is NOT resolved by its permanent flag. Within one run
  // the won fight marks it completed (room progress); every new run — fresh entry or "다시 도전하기" — starts it
  // unresolved, and with the story already seen it is an ordinary normal fight (2 questions from the run's pool).
  next[map.startRoomId] = { roomId: map.startRoomId, eventCompleted: hasFlag(flags, UNIT3_FLOOR2_FLAGS.startEvent) };
  return next;
}

/** Floor 2 can only be offered once the Floor 1 quest is completed (reward claimed first). */
export function isUnit3Floor2Available(state: Pick<GameSaveState, "questState">): boolean {
  return state.questState[UNIT3_FLOOR1_QUEST_ID] === "completed";
}

export function getUnit3Floor2QuestPhase(state: Pick<GameSaveState, "questState" | "firstObjectiveEventSeen">): Unit3QuestPhase | "locked" {
  if (!isUnit3Floor2Available(state)) return "locked";
  const status = state.questState[UNIT3_FLOOR2_QUEST_ID];
  if (status === "completed") return "completed";
  if (status !== "active") return "notAccepted";
  return hasFlag(state.firstObjectiveEventSeen, UNIT3_FLOOR2_FLAGS.finalStory) ? "readyToComplete" : "active";
}

const withFlags = (state: GameSaveState, ...flags: string[]): GameSaveState => ({
  ...state,
  firstObjectiveEventSeen: { ...state.firstObjectiveEventSeen, ...Object.fromEntries(flags.map((flag) => [flag, true])) },
});

/** ① "카프를 찾으러 가겠습니다." — quest accepted, Floor 2 unlocked. Idempotent; never before Floor 1 is completed. */
export function acceptUnit3Floor2Quest(state: GameSaveState): GameSaveState {
  if (!isUnit3Floor2Available(state)) return state;
  const status = state.questState[UNIT3_FLOOR2_QUEST_ID];
  if (status === "active" || status === "completed") return state;
  return withFlags({
    ...state,
    questState: { ...state.questState, [UNIT3_FLOOR2_QUEST_ID]: "active" },
    floorUnlockState: { unlockedFloorIds: [...new Set([...state.floorUnlockState.unlockedFloorIds, UNIT3_FLOOR2_ID])] },
  }, UNIT3_FLOOR2_FLAGS.questAccepted);
}

/**
 * Quest completion: rewards exactly once (guarded by `rewardClaimed`). Kaf is not rescued.
 * Phase 3 hotfix: gold + potions + the achievement record only. 애국계몽 만년필 (Phase 4 rename; was 배움의 만년필) is the floor's special reward,
 * claimed in the achievement window (unit3Achievements.ts); `penUnlocked` is no longer written (it now marks
 * saves whose completion already handed out the pen, see migrateUnit3SpecialRewards).
 */
export function completeUnit3Floor2Quest(state: GameSaveState): GameSaveState {
  if (getUnit3Floor2QuestPhase(state) !== "readyToComplete" || state.rewardClaimed[UNIT3_FLOOR2_QUEST_ID]) return state;
  const inventoryState = changeItemQuantity(state.inventoryState, "potion-small", UNIT3_FLOOR2_REWARD.smallPotions);
  return withFlags({
    ...state,
    playerState: { ...state.playerState, gold: state.playerState.gold + UNIT3_FLOOR2_REWARD.gold },
    inventoryState,
    questState: { ...state.questState, [UNIT3_FLOOR2_QUEST_ID]: "completed" },
    rewardClaimed: { ...state.rewardClaimed, [UNIT3_FLOOR2_QUEST_ID]: true },
    achievementReceived: { ...state.achievementReceived, [UNIT3_FLOOR2_ACHIEVEMENT.id]: true },
  }, UNIT3_FLOOR2_FLAGS.questCompleted);
}

/** Final story (학교 마당) ended: floor cleared, 카프 stays at the school, back to the base camp. */
export function finishUnit3Floor2Run(state: GameSaveState): GameSaveState {
  return {
    ...withFlags(state, UNIT3_FLOOR2_FLAGS.finalStory, UNIT3_FLOOR2_FLAGS.kafStaysAtSchool),
    currentFloorId: null,
    currentFloorRun: null,
    playerState: { ...state.playerState, currentHp: state.playerState.maxHp },
    clearedFloorIds: [...new Set([...state.clearedFloorIds, UNIT3_FLOOR2_ID])],
  };
}

/**
 * The floor the student currently has to clear: the active, not yet cleared quest floor (Floor 2 first).
 * null when no floor is pending (no quest accepted yet, or the accepted floor is already cleared).
 */
export function getUnit3TargetFloorId(state: Pick<GameSaveState, "questState" | "firstObjectiveEventSeen">): typeof UNIT3_FLOOR2_ID | "unit3-floor-1" | null {
  if (state.questState[UNIT3_FLOOR2_QUEST_ID] === "active" && !hasFlag(state.firstObjectiveEventSeen, UNIT3_FLOOR2_FLAGS.finalStory)) return UNIT3_FLOOR2_ID;
  if (state.questState[UNIT3_FLOOR1_QUEST_ID] === "active" && !hasFlag(state.firstObjectiveEventSeen, UNIT3_FLOOR1_FLAGS.finalStory)) return "unit3-floor-1";
  return null;
}
