import { FLOOR_QUESTION_POOLS } from "../../data/floorQuestionPools";
import type { GameSaveState } from "../../save/saveStateAdapter";
import { changeItemQuantity, getItemQuantity } from "../inventory/inventoryState";
import {
  UNIT3_FLOOR1_ACHIEVEMENT, UNIT3_FLOOR1_FLAGS, UNIT3_FLOOR1_ID, UNIT3_FLOOR1_QUEST_ID, UNIT3_FLOOR1_SPECIAL_REWARD, UNIT3_FLOOR1_TITLE,
} from "./unit3Floor1";
import {
  UNIT3_FLOOR2_ACHIEVEMENT, UNIT3_FLOOR2_FLAGS, UNIT3_FLOOR2_ID, UNIT3_FLOOR2_QUEST_ID, UNIT3_FLOOR2_SPECIAL_REWARD, UNIT3_FLOOR2_TITLE,
} from "./unit3Floor2";

/**
 * Unit 3 achievements and special rewards (Phase 3 hotfix).
 *
 * - Completing a floor's story quest gives the quest reward automatically (gold, potions) and records the
 *   achievement (`achievementReceived[achievement.id]`).
 * - The floor's special reward (weapon skin now; armour / rare items later) is claimed in the achievement
 *   window once BOTH the story quest is completed AND enough DIFFERENT questions of that floor were answered
 *   correctly. It never gates the next floor.
 *
 * Correct answers are counted per floor by question id (Unit 2 kept only the best single-run count):
 *   flag `unit3-correct:<floorId>:<questionId>` in `firstObjectiveEventSeen` (a boolean record the save schema
 *   already keeps — no schema change). The same question counts once however often it is answered; wrong
 *   answers are not recorded; a question missed earlier counts when it is answered correctly later; story
 *   choices are not questions; the records survive retries, base-camp returns, reloads and "이어하기".
 * Only ids in the floor's current question pool count, so another floor's question (or an interim question
 * that is later replaced by the real data) never adds to the total.
 *
 * Saves from before this hotfix: the per-run best count (`floorBestCorrect`, written by Phase 2/3 runs; each run
 * draws distinct questions, so it is a lower bound of distinct correct questions) is reused — progress is the
 * larger of the two. No count is invented when there is no record. `floorBestCorrect` is no longer written for
 * Unit 3 floors, so it stays exactly the legacy value.
 */
export const UNIT3_CORRECT_FLAG_PREFIX = "unit3-correct:";
export const UNIT3_SPECIAL_REWARD_KEY_PREFIX = "unit3-special-reward:";

export type Unit3FloorAchievementSpec = {
  floorId: string;
  floorLabel: string;
  floorTitle: string;
  questId: string;
  achievement: { id: string; title: string; description: string };
  /** Special reward item (claimed in the achievement window). */
  rewardItemId: string;
  /** Distinct correct questions needed on this floor (6–8 per floor; set per floor). */
  requiredCorrect: number;
  /** Flag the pre-hotfix quest completion wrote when it handed out the weapon (migration marker). */
  legacyGrantFlag: string;
};

export const UNIT3_FLOOR_ACHIEVEMENTS: readonly Unit3FloorAchievementSpec[] = [
  {
    floorId: UNIT3_FLOOR1_ID, floorLabel: "던전 1층", floorTitle: UNIT3_FLOOR1_TITLE, questId: UNIT3_FLOOR1_QUEST_ID,
    achievement: UNIT3_FLOOR1_ACHIEVEMENT, rewardItemId: UNIT3_FLOOR1_SPECIAL_REWARD.itemId,
    requiredCorrect: UNIT3_FLOOR1_SPECIAL_REWARD.requiredCorrect, legacyGrantFlag: UNIT3_FLOOR1_FLAGS.hwandoUnlocked,
  },
  {
    floorId: UNIT3_FLOOR2_ID, floorLabel: "던전 2층", floorTitle: UNIT3_FLOOR2_TITLE, questId: UNIT3_FLOOR2_QUEST_ID,
    achievement: UNIT3_FLOOR2_ACHIEVEMENT, rewardItemId: UNIT3_FLOOR2_SPECIAL_REWARD.itemId,
    requiredCorrect: UNIT3_FLOOR2_SPECIAL_REWARD.requiredCorrect, legacyGrantFlag: UNIT3_FLOOR2_FLAGS.penUnlocked,
  },
];

export const getUnit3FloorAchievement = (floorId: string) => UNIT3_FLOOR_ACHIEVEMENTS.find((spec) => spec.floorId === floorId);
export const isUnit3AchievementFloor = (floorId: string) => Boolean(getUnit3FloorAchievement(floorId));
export const unit3CorrectFlag = (floorId: string, questionId: string) => `${UNIT3_CORRECT_FLAG_PREFIX}${floorId}:${questionId}`;
export const unit3SpecialRewardKey = (floorId: string) => `${UNIT3_SPECIAL_REWARD_KEY_PREFIX}${floorId}`;

/** Distinct question ids of the floor's current pool (what can be counted at all). */
export function getUnit3FloorQuestionIds(floorId: string): Set<string> {
  const pool = (FLOOR_QUESTION_POOLS as Readonly<Record<string, readonly { id: string }[] | undefined>>)[floorId] ?? [];
  return new Set(pool.map((question) => question.id));
}

type CorrectState = Pick<GameSaveState, "firstObjectiveEventSeen" | "floorBestCorrect">;

/** Records one correct answer (idempotent; ignores non-Unit 3 floors and ids outside the floor's pool). */
export function recordUnit3CorrectAnswer<T extends Pick<GameSaveState, "firstObjectiveEventSeen">>(state: T, floorId: string, questionId: string): T {
  if (!isUnit3AchievementFloor(floorId) || !getUnit3FloorQuestionIds(floorId).has(questionId)) return state;
  const flag = unit3CorrectFlag(floorId, questionId);
  if (state.firstObjectiveEventSeen[flag] === true) return state;
  return { ...state, firstObjectiveEventSeen: { ...state.firstObjectiveEventSeen, [flag]: true } };
}

/** Distinct correct questions recorded for the floor (current pool only). */
export function getUnit3DistinctCorrectCount(state: Pick<GameSaveState, "firstObjectiveEventSeen">, floorId: string): number {
  const ids = getUnit3FloorQuestionIds(floorId);
  let count = 0;
  for (const id of ids) if (state.firstObjectiveEventSeen[unit3CorrectFlag(floorId, id)] === true) count += 1;
  return count;
}

/** Progress shown and checked: distinct correct questions, or the legacy per-run best if that is larger. */
export function getUnit3CorrectProgress(state: CorrectState, floorId: string): number {
  const legacy = Math.max(0, Math.floor(state.floorBestCorrect?.[floorId] ?? 0));
  return Math.max(getUnit3DistinctCorrectCount(state, floorId), legacy);
}

type RewardState = Pick<GameSaveState, "questState" | "firstObjectiveEventSeen" | "floorBestCorrect" | "rewardClaimed" | "inventoryState" | "achievementReceived">;

export function isUnit3SpecialRewardClaimed(state: RewardState, spec: Unit3FloorAchievementSpec): boolean {
  return state.rewardClaimed[unit3SpecialRewardKey(spec.floorId)] === true
    // Pre-hotfix saves: the quest completion already handed the weapon out.
    || state.firstObjectiveEventSeen[spec.legacyGrantFlag] === true;
}

export type Unit3SpecialRewardStatus = {
  progress: number;
  required: number;
  questCompleted: boolean;
  achieved: boolean;
  claimed: boolean;
  canClaim: boolean;
};

export function getUnit3SpecialRewardStatus(state: RewardState, spec: Unit3FloorAchievementSpec): Unit3SpecialRewardStatus {
  const progress = getUnit3CorrectProgress(state, spec.floorId);
  const questCompleted = state.questState[spec.questId] === "completed";
  const claimed = isUnit3SpecialRewardClaimed(state, spec);
  return {
    progress,
    required: spec.requiredCorrect,
    questCompleted,
    achieved: questCompleted || state.achievementReceived[spec.achievement.id] === true,
    claimed,
    canClaim: !claimed && questCompleted && progress >= spec.requiredCorrect,
  };
}

/** "받기": grants the special reward once (re-checked against the latest state, so double clicks give nothing). */
export function claimUnit3SpecialReward<T extends RewardState>(state: T, floorId: string): T {
  const spec = getUnit3FloorAchievement(floorId);
  if (!spec || !getUnit3SpecialRewardStatus(state, spec).canClaim) return state;
  const inventoryState = getItemQuantity(state.inventoryState, spec.rewardItemId) === 0
    ? changeItemQuantity(state.inventoryState, spec.rewardItemId, 1)
    : state.inventoryState;
  return { ...state, inventoryState, rewardClaimed: { ...state.rewardClaimed, [unit3SpecialRewardKey(floorId)]: true } };
}

/**
 * Save migration (applied when a save is loaded): a player whose pre-hotfix quest completion already gave the
 * weapon — legacy grant flag, or the weapon is owned after the quest was completed — is marked "수령 완료".
 * Nothing is taken away, the equipped skin and the quest / achievement records are untouched, and no correct
 * answers are invented. Idempotent.
 */
export function migrateUnit3SpecialRewards<T extends RewardState>(state: T): T {
  let rewardClaimed = state.rewardClaimed;
  for (const spec of UNIT3_FLOOR_ACHIEVEMENTS) {
    const key = unit3SpecialRewardKey(spec.floorId);
    if (rewardClaimed[key]) continue;
    const legacyGranted = state.firstObjectiveEventSeen[spec.legacyGrantFlag] === true;
    const ownedAfterCompletion = state.questState[spec.questId] === "completed" && getItemQuantity(state.inventoryState, spec.rewardItemId) > 0;
    if (legacyGranted || ownedAfterCompletion) rewardClaimed = { ...rewardClaimed, [key]: true };
  }
  return rewardClaimed === state.rewardClaimed ? state : { ...state, rewardClaimed };
}
