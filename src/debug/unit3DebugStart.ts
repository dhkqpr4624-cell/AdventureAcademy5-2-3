import { completeChapter3Intro } from "../app/chapter3Flow";
import { FLOOR_QUESTION_POOLS } from "../data/floorQuestionPools";
import { createDungeonRun } from "../game/dungeon/generation/floor1DungeonRuntime";
import type { DungeonFloorRunState, DungeonRoomProgress } from "../game/dungeon/dungeonTypes";
import type { FloorId } from "../game/floor/floorTypes";
import { changeItemQuantity, getItemQuantity } from "../game/inventory/inventoryState";
import { completeUnit3QuestWithSpecialReward, getUnit3FloorAchievement, recordUnit3CorrectAnswer } from "../game/chapter3/unit3Achievements";
import { UNIT3_FLOOR1_FLAGS, UNIT3_FLOOR1_ID, UNIT3_FLOOR1_TITLE, acceptUnit3Floor1Quest, completeUnit3Floor1Quest, finishUnit3Floor1Run, markUnit3Flag } from "../game/chapter3/unit3Floor1";
import { UNIT3_FLOOR2_ID, UNIT3_FLOOR2_TITLE, acceptUnit3Floor2Quest, completeUnit3Floor2Quest, finishUnit3Floor2Run } from "../game/chapter3/unit3Floor2";
import { UNIT3_FLOOR3_ID, UNIT3_FLOOR3_TITLE, acceptUnit3Floor3Quest, completeUnit3Floor3Quest, finishUnit3Floor3Run } from "../game/chapter3/unit3Floor3";
import { UNIT3_FLOOR4_ID, UNIT3_FLOOR4_TITLE, acceptUnit3Floor4Quest, completeUnit3Floor4Quest, finishUnit3Floor4Run, markUnit3Floor4DefenseReady } from "../game/chapter3/unit3Floor4";
import { getUnit3StoryFloor } from "../game/chapter3/unit3StoryFloors";
import { createInitialGameSaveState, type GameSaveState } from "../save/saveStateAdapter";

/**
 * Phase 4 hotfix · Debug Mode (title: Ctrl+Shift+D → Debug → floor → 초반 / 후반). Only implemented Unit 3 floors
 * are listed; a new floor is one entry here (quest ops) — its story flags come from the unit3StoryFloors registry.
 * The states are built with the real quest / story / reward functions, so they match normal play.
 */
type Op = (state: GameSaveState) => GameSaveState;
/** `afterRunFlags`: one-time camp scenes that normally play after the floor's run (seen when the floor is done). */
export type Unit3DebugFloor = { floorId: FloorId; label: string; title: string; accept: Op; complete: Op; finish: Op; afterRunFlags?: readonly string[] };
export const UNIT3_DEBUG_FLOORS: readonly Unit3DebugFloor[] = [
  { floorId: UNIT3_FLOOR1_ID, label: "던전 1층", title: UNIT3_FLOOR1_TITLE, accept: acceptUnit3Floor1Quest, complete: completeUnit3Floor1Quest, finish: finishUnit3Floor1Run, afterRunFlags: [UNIT3_FLOOR1_FLAGS.baseCampReturn] },
  { floorId: UNIT3_FLOOR2_ID, label: "던전 2층", title: UNIT3_FLOOR2_TITLE, accept: acceptUnit3Floor2Quest, complete: completeUnit3Floor2Quest, finish: finishUnit3Floor2Run },
  { floorId: UNIT3_FLOOR3_ID, label: "던전 3층", title: UNIT3_FLOOR3_TITLE, accept: acceptUnit3Floor3Quest, complete: completeUnit3Floor3Quest, finish: finishUnit3Floor3Run },
  // Phase 5: Floor 4 is an event / defense screen — 후반 = quest accepted + story up to the shield creation seen.
  { floorId: UNIT3_FLOOR4_ID, label: "던전 4층", title: UNIT3_FLOOR4_TITLE, accept: acceptUnit3Floor4Quest, complete: completeUnit3Floor4Quest, finish: finishUnit3Floor4Run },
];
export type Unit3DebugPhase = "early" | "late";

/** Every in-dungeon story flag of a floor except the final room's (start, main event, 3 rooms, post-event talk). */
function markDungeonStoriesBeforeFinal(state: GameSaveState, floorId: FloorId): GameSaveState {
  const floor = getUnit3StoryFloor(floorId);
  if (!floor) return state;
  return [floor.flags.startEvent, floor.flags.mainFight, ...floor.storyFlags, floor.flags.postEventTalk].reduce(markUnit3Flag, state);
}

/** A whole floor played: accepted, every story, final event, the special reward's correct answers, reported. */
function completeFloor(state: GameSaveState, floor: Unit3DebugFloor): GameSaveState {
  let next = markDungeonStoriesBeforeFinal(floor.accept(state), floor.floorId);
  next = (floor.afterRunFlags ?? []).reduce(markUnit3Flag, floor.finish(next));
  const spec = getUnit3FloorAchievement(floor.floorId);
  const pool = (FLOOR_QUESTION_POOLS as Record<string, readonly { id: string }[]>)[floor.floorId] ?? [];
  for (const question of pool.slice(0, spec?.requiredCorrect ?? 0)) next = recordUnit3CorrectAnswer(next, floor.floorId, question.id);
  return completeUnit3QuestWithSpecialReward(next, floor.floorId, floor.complete);
}

export function createUnit3DebugStart(floorId: FloorId, phase: Unit3DebugPhase): { state: GameSaveState; floorRun: DungeonFloorRunState | null; enterDungeon?: boolean } {
  const index = UNIT3_DEBUG_FLOORS.findIndex((floor) => floor.floorId === floorId);
  if (index < 0) throw new Error(`[debug] not a Unit 3 floor: ${floorId}`);
  const initial = createInitialGameSaveState();
  let state = completeChapter3Intro({ ...initial, playerState: { ...initial.playerState, name: "DEBUG" } });
  for (const floor of UNIT3_DEBUG_FLOORS.slice(0, index)) state = completeFloor(state, floor);
  // Enough HP and potions to test the next part normally.
  const potions = getItemQuantity(state.inventoryState, "potion-small");
  if (potions < 5) state = { ...state, inventoryState: changeItemQuantity(state.inventoryState, "potion-small", 5 - potions) };
  state = { ...state, playerState: { ...state.playerState, currentHp: state.playerState.maxHp }, currentFloorId: null, currentFloorRun: null };
  if (phase === "early") return { state, floorRun: null };
  if (floorId === UNIT3_FLOOR4_ID) {
    // shield 60 · processed 0 come from the screen's fresh defense; 루나 not joined, no reward.
    return { state: markUnit3Floor4DefenseReady(acceptUnit3Floor4Quest(state)), floorRun: null, enterDungeon: true };
  }

  // 후반: quest accepted, every story before the final room seen, player one room before the (untouched) final room.
  state = markDungeonStoriesBeforeFinal(UNIT3_DEBUG_FLOORS[index].accept(state), floorId);
  const run = createDungeonRun(floorId, `debug-late-${floorId}`);
  const map = getUnit3StoryFloor(floorId)!.prepareMap(run.map, run.seed);
  const finalRoom = map.rooms.find((room) => room.isFinalQuestRoom)!;
  const connection = map.connections.find((c) => c.fromRoomId === finalRoom.id || c.toRoomId === finalRoom.id)!;
  const beforeFinal = connection.fromRoomId === finalRoom.id ? connection.toRoomId : connection.fromRoomId;
  const roomProgress: Record<string, DungeonRoomProgress> = Object.fromEntries(map.rooms.map((room) => [room.id, { roomId: room.id, eventCompleted: room.id !== finalRoom.id }]));
  return { state, floorRun: { floorId, seed: run.seed, currentRoomId: beforeFinal, roomProgress, minimapVisible: true } };
}
