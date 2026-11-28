import type { GameSaveState } from "../../save/saveStateAdapter";
import { hasFlag, type Unit3QuestPhase } from "./unit3Floor1";
import { UNIT3_FLOOR3_QUEST_ID } from "./unit3Floor3";

/**
 * Unit 3 · Floor 4 — 3·1 운동과 대한민국 임시정부. Quest: 꺼지지 않는 만세 소리 (데네브).
 *
 * This floor only: no 3D dungeon, no monster fights. A dedicated scene (Unit3Floor4Screen): 탑골공원 story →
 * 아우내 장터 event map (루나 발견, 보호막 생성) → a 12-question shield defense → success / failure → (success)
 * the scripted collapse, 안전한 골목, 대한민국 임시정부, 루나's choice → base camp. Floors 5+ go back to the
 * normal exploration / combat flow.
 *
 * Saved flags (`firstObjectiveEventSeen`, no schema change):
 * - defenseReady: the story up to the shield creation was seen (or skipped) → later entries start at the defense.
 * - finalStory + lunaJoined: written together when the post-success story ends (played or skipped).
 * A failed attempt saves nothing but the distinct correct answers (the existing per-floor policy).
 */
export const UNIT3_FLOOR4_ID = "unit3-floor-4" as const;
export const UNIT3_FLOOR4_QUEST_ID = "quest-unit3-floor-4";
export const UNIT3_FLOOR4_TITLE = "3·1 운동과 대한민국 임시정부";
export const UNIT3_FLOOR4_QUEST_TITLE = "꺼지지 않는 만세 소리";

export const UNIT3_FLOOR4_FLAGS = {
  questAccepted: "unit3-floor-4:quest-accepted",
  /** 탑골공원 → 아우내 장터 → 루나 발견 → 보호막 생성 seen (or skipped): the next entries start at the defense */
  defenseReady: "unit3-floor-4:defense-ready",
  /** the defense was won and the whole post-success story ended (played or skipped) */
  finalStory: "unit3-floor-4:final-story",
  /** 루나 is a base-camp NPC (written with finalStory — independent of the quest report) */
  lunaJoined: "unit3-floor-4:luna-joined",
  questCompleted: "unit3-floor-4:quest-completed",
} as const;

export const UNIT3_FLOOR4_REWARD = { gold: 10, smallPotions: 0, weaponItemId: "weapon-taegeuk-flag" } as const;
/** Special reward: quest completed + 8 distinct correct Floor 4 questions (granted with the report if met then). */
export const UNIT3_FLOOR4_SPECIAL_REWARD = { itemId: "weapon-taegeuk-flag", requiredCorrect: 8 } as const;
export const UNIT3_FLOOR4_ACHIEVEMENT = {
  id: "achievement-unit3-unquenched-manse",
  title: "꺼지지 않는 만세 소리",
  description: "만세 운동의 기록을 지키고 루나와 함께 돌아왔다.",
} as const;

/* ------------------------------------------------------------------ the shield defense (pure rules) */
export const UNIT3_FLOOR4_DEFENSE = { total: 12, initial: 60, max: 100, min: 0, correct: 10, wrong: -15 } as const;
export type Floor4DefenseEvent = "talk3" | "evacuate6" | "success" | "fail";
export type Floor4DefenseState = {
  shield: number;
  /** questions fully processed (answer submitted + answer / explanation confirmed) */
  processed: number;
  /** index of the question whose answer was applied (the shield changes once per question) */
  answeredIndex: number;
  /** shield reached 0: failure is fixed at once (shown after the answer / explanation is confirmed) */
  failed: boolean;
  /** processed-count events already fired in this attempt */
  firedEvents: readonly Floor4DefenseEvent[];
};
export const createFloor4Defense = (): Floor4DefenseState => ({ shield: UNIT3_FLOOR4_DEFENSE.initial, processed: 0, answeredIndex: -1, failed: false, firedEvents: [] });
const clampShield = (value: number) => Math.max(UNIT3_FLOOR4_DEFENSE.min, Math.min(UNIT3_FLOOR4_DEFENSE.max, value));

/** One answer for question `index` (0-based). A second call for the same question (double click) is ignored. */
export function applyFloor4Answer(state: Floor4DefenseState, index: number, correct: boolean): Floor4DefenseState {
  if (state.failed || index !== state.processed || state.answeredIndex === index || state.processed >= UNIT3_FLOOR4_DEFENSE.total) return state;
  const shield = clampShield(state.shield + (correct ? UNIT3_FLOOR4_DEFENSE.correct : UNIT3_FLOOR4_DEFENSE.wrong));
  return { ...state, shield, answeredIndex: index, failed: shield <= 0 };
}

/**
 * The answer / explanation of question `index` was confirmed: the question counts as processed and the event of
 * that count (if any, once per attempt) is returned. Failure comes before every other event.
 */
export function processFloor4Question(state: Floor4DefenseState, index: number): { state: Floor4DefenseState; event: Floor4DefenseEvent | null } {
  if (index !== state.processed || state.answeredIndex !== index) return { state, event: null };
  const processed = state.processed + 1;
  const event: Floor4DefenseEvent | null = state.failed ? "fail"
    : processed >= UNIT3_FLOOR4_DEFENSE.total ? (state.shield >= 1 ? "success" : "fail")
    : processed === 3 ? "talk3" : processed === 6 ? "evacuate6" : null;
  const fresh = event && !state.firedEvents.includes(event) ? event : null;
  return { state: { ...state, processed, firedEvents: fresh ? [...state.firedEvents, fresh] : state.firedEvents }, event: fresh };
}
/** From question 7 on (after the 6-question event) the attacks sound heavier. */
export const isFloor4FinalStretch = (state: Floor4DefenseState) => state.processed >= 6;

/* ------------------------------------------------------------------ quest */
export function isUnit3Floor4Available(state: Pick<GameSaveState, "questState">): boolean {
  return state.questState[UNIT3_FLOOR3_QUEST_ID] === "completed";
}

export function getUnit3Floor4QuestPhase(state: Pick<GameSaveState, "questState" | "firstObjectiveEventSeen">): Unit3QuestPhase | "locked" {
  if (!isUnit3Floor4Available(state)) return "locked";
  const status = state.questState[UNIT3_FLOOR4_QUEST_ID];
  if (status === "completed") return "completed";
  if (status !== "active") return "notAccepted";
  return hasFlag(state.firstObjectiveEventSeen, UNIT3_FLOOR4_FLAGS.finalStory) ? "readyToComplete" : "active";
}

const withFlags = (state: GameSaveState, ...flags: string[]): GameSaveState => ({
  ...state,
  firstObjectiveEventSeen: { ...state.firstObjectiveEventSeen, ...Object.fromEntries(flags.map((flag) => [flag, true])) },
});

/** ① "다음 층으로 가겠습니다." — quest accepted, Floor 4 unlocked. Idempotent; never before Floor 3 is completed. */
export function acceptUnit3Floor4Quest(state: GameSaveState): GameSaveState {
  if (!isUnit3Floor4Available(state)) return state;
  const status = state.questState[UNIT3_FLOOR4_QUEST_ID];
  if (status === "active" || status === "completed") return state;
  return withFlags({
    ...state,
    questState: { ...state.questState, [UNIT3_FLOOR4_QUEST_ID]: "active" },
    floorUnlockState: { unlockedFloorIds: [...new Set([...state.floorUnlockState.unlockedFloorIds, UNIT3_FLOOR4_ID])] },
  }, UNIT3_FLOOR4_FLAGS.questAccepted);
}

/** 데네브's report: gold + achievement exactly once (the special item via completeUnit3QuestWithSpecialReward). */
export function completeUnit3Floor4Quest(state: GameSaveState): GameSaveState {
  if (getUnit3Floor4QuestPhase(state) !== "readyToComplete" || state.rewardClaimed[UNIT3_FLOOR4_QUEST_ID]) return state;
  return withFlags({
    ...state,
    playerState: { ...state.playerState, gold: state.playerState.gold + UNIT3_FLOOR4_REWARD.gold },
    questState: { ...state.questState, [UNIT3_FLOOR4_QUEST_ID]: "completed" },
    rewardClaimed: { ...state.rewardClaimed, [UNIT3_FLOOR4_QUEST_ID]: true },
    achievementReceived: { ...state.achievementReceived, [UNIT3_FLOOR4_ACHIEVEMENT.id]: true },
  }, UNIT3_FLOOR4_FLAGS.questCompleted);
}

/** The story up to the shield creation was seen / skipped: entries after this start right at the defense. */
export const markUnit3Floor4DefenseReady = (state: GameSaveState) => withFlags(state, UNIT3_FLOOR4_FLAGS.defenseReady);

/**
 * The defense was won and the post-success story ended (played or skipped): floor cleared, 루나 joins the base
 * camp — saved here, before (and independent of) the quest report. Replays after this never repeat it.
 */
export function finishUnit3Floor4Run(state: GameSaveState): GameSaveState {
  return {
    ...withFlags(state, UNIT3_FLOOR4_FLAGS.defenseReady, UNIT3_FLOOR4_FLAGS.finalStory, UNIT3_FLOOR4_FLAGS.lunaJoined),
    currentFloorId: null,
    currentFloorRun: null,
    clearedFloorIds: [...new Set([...state.clearedFloorIds, UNIT3_FLOOR4_ID])],
  };
}

/** 루나 is at the base camp (after the Floor 4 story). */
export function isLunaAtBaseCamp(state: Pick<GameSaveState, "firstObjectiveEventSeen">): boolean {
  return hasFlag(state.firstObjectiveEventSeen, UNIT3_FLOOR4_FLAGS.lunaJoined);
}
