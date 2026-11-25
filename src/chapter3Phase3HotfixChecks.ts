import { createInitialGameSaveState, applySaveDataToGameState, createSaveDataFromGameState, type GameSaveState } from "./save/saveStateAdapter";
import { validateCurrentSave } from "./save/saveSchema";
import { FLOOR_QUESTION_POOLS } from "./data/floorQuestionPools";
import { createDungeonRun } from "./game/dungeon/generation/floor1DungeonRuntime";
import { allocateDungeonRunQuestions } from "./game/dungeon/dungeonRunQuestionAllocator";
import { getItemQuantity } from "./game/inventory/inventoryState";
import {
  UNIT3_FLOOR_ACHIEVEMENTS, claimUnit3SpecialReward, getUnit3CorrectProgress, getUnit3DistinctCorrectCount, getUnit3FloorQuestionIds,
  getUnit3SpecialRewardStatus, migrateUnit3SpecialRewards, recordUnit3CorrectAnswer, unit3CorrectFlag, unit3SpecialRewardKey,
} from "./game/chapter3/unit3Achievements";
import {
  UNIT3_FLOOR1_FLAGS, UNIT3_FLOOR1_ID, UNIT3_FLOOR1_QUEST_ID, UNIT3_FLOOR1_STORY_FLAGS, UNIT3_FLOOR1_STORY_ROOM_IDS, applyUnit3Floor1Progress,
  completeUnit3Floor1Quest, findCartRoomId, finishUnit3Floor1Run, markUnit3Flag, prepareUnit3Floor1Map,
} from "./game/chapter3/unit3Floor1";
import {
  UNIT3_FLOOR2_FLAGS, UNIT3_FLOOR2_ID, UNIT3_FLOOR2_QUEST_ID, UNIT3_FLOOR2_STORY_FLAGS, applyUnit3Floor2Progress, completeUnit3Floor2Quest, prepareUnit3Floor2Map,
} from "./game/chapter3/unit3Floor2";
import { UNIT3_FLOOR2_ALL_STORIES } from "./data/chapter3/floor2Stories";
import { resolveKafPlacement } from "./game/chapter3/Unit3Floor2Stage";
import { getMonsterVisualDefinition } from "./game/monster/monsterDefinitions";
import { CHAPTER3_BASE_CAMP_MAP } from "./data/chapter3/chapter3BaseCamp";
import { rollTramDelayMs } from "./game/baseCamp/BaseCampTram";
import { BGM_LOOP_REGIONS, BGM_LOUDNESS_TRIM, BGM_URLS, effectiveBgmVolume } from "./game/audioBgm";

/** Phase 3 hotfix checks: special rewards / distinct-correct counting / migration, story-fight rooms, Kaf placement, tram, dungeon BGM. */
const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(`[chapter3 phase3 hotfix] ${message}`); };

const baseState = (): GameSaveState => {
  const initial = createInitialGameSaveState();
  return { ...initial, playerState: { ...initial.playerState, name: "지지" } };
};

export function runChapter3Phase3HotfixChecks(): void {
  /* ---- 1. per-floor data: 6–8 distinct correct questions, pools large enough, no duplicate ids */
  const [floor1, floor2] = UNIT3_FLOOR_ACHIEVEMENTS;
  assert(floor1.floorId === UNIT3_FLOOR1_ID && floor1.requiredCorrect === 6 && floor1.rewardItemId === "weapon-uibyeong-hwando", "floor 1: 의병의 환도, 6 questions");
  assert(floor2.floorId === UNIT3_FLOOR2_ID && floor2.requiredCorrect === 7 && floor2.rewardItemId === "weapon-learning-fountain-pen", "floor 2: 애국계몽 만년필, 7 questions");
  for (const spec of UNIT3_FLOOR_ACHIEVEMENTS) {
    assert(spec.requiredCorrect >= 6 && spec.requiredCorrect <= 8, `${spec.floorId}: required correct within 6–8`);
    const pool = (FLOOR_QUESTION_POOLS as Record<string, readonly { id: string }[]>)[spec.floorId];
    assert(pool.length === new Set(pool.map((question) => question.id)).size, `${spec.floorId}: no duplicate question ids in the pool`);
    assert(getUnit3FloorQuestionIds(spec.floorId).size >= spec.requiredCorrect, `${spec.floorId}: the pool has enough distinct questions for the reward`);
    // one run already draws distinct questions; over runs every pool question can come up
    const run = createDungeonRun(spec.floorId as Parameters<typeof createDungeonRun>[0], `hotfix-${spec.floorId}`);
    const map = spec.floorId === UNIT3_FLOOR2_ID ? prepareUnit3Floor2Map(run.map, run.seed) : prepareUnit3Floor1Map(run.map, run.seed);
    const assigned = Object.values(allocateDungeonRunQuestions(map, run.seed, spec.floorId)).flat().map((question) => question.id);
    assert(assigned.length === new Set(assigned).size, `${spec.floorId}: one run never repeats a question`);
  }

  /* ---- 2. distinct counting: repeats count once, other floors / unknown ids never count, floors are separate */
  const ids = [...getUnit3FloorQuestionIds(UNIT3_FLOOR1_ID)];
  let state = baseState();
  for (let i = 0; i < 5; i += 1) state = recordUnit3CorrectAnswer(state, UNIT3_FLOOR1_ID, ids[i]);
  const again = recordUnit3CorrectAnswer(recordUnit3CorrectAnswer(state, UNIT3_FLOOR1_ID, ids[0]), UNIT3_FLOOR1_ID, ids[1]);
  assert(getUnit3DistinctCorrectCount(again, UNIT3_FLOOR1_ID) === 5 && again === state, "same question answered again: counted once (state unchanged)");
  assert(recordUnit3CorrectAnswer(state, UNIT3_FLOOR1_ID, "not-a-question") === state, "ids outside the floor pool are ignored");
  assert(recordUnit3CorrectAnswer(state, "floor-3", ids[0]) === state, "non-Unit 3 floors are ignored");
  assert(getUnit3DistinctCorrectCount(state, UNIT3_FLOOR2_ID) === 0, "floor 1 answers do not count on floor 2");
  const floor2Ids = [...getUnit3FloorQuestionIds(UNIT3_FLOOR2_ID)];
  let both = recordUnit3CorrectAnswer(state, UNIT3_FLOOR2_ID, floor2Ids[0]);
  assert(getUnit3DistinctCorrectCount(both, UNIT3_FLOOR1_ID) === 5 && getUnit3DistinctCorrectCount(both, UNIT3_FLOOR2_ID) === 1, "floors counted independently");
  both = { ...both, firstObjectiveEventSeen: { ...both.firstObjectiveEventSeen, "unit3-correct:unit3-floor-1:stale-old-id": true } };
  assert(getUnit3DistinctCorrectCount(both, UNIT3_FLOOR1_ID) === 5, "stale ids (not in the current pool) do not count");
  // a missed question counts when answered correctly in a later run; records survive save / load
  const later = recordUnit3CorrectAnswer(state, UNIT3_FLOOR1_ID, ids[5]);
  const reloaded = applySaveDataToGameState(validateCurrentSave(JSON.parse(JSON.stringify(createSaveDataFromGameState(later))))!);
  assert(getUnit3DistinctCorrectCount(reloaded, UNIT3_FLOOR1_ID) === 6 && reloaded.firstObjectiveEventSeen[unit3CorrectFlag(UNIT3_FLOOR1_ID, ids[5])], "records survive save validation / reload");

  /* ---- 3. claim rules: quest completed AND enough distinct correct questions; once only */
  const withCorrect = (base: GameSaveState, floorId: string, count: number) => {
    const pool = [...getUnit3FloorQuestionIds(floorId)];
    let next = base;
    for (let i = 0; i < count; i += 1) next = recordUnit3CorrectAnswer(next, floorId, pool[i]);
    return next;
  };
  const completedFloor1 = (() => {
    const b = baseState(); let s: GameSaveState = { ...b, questState: { ...b.questState, [UNIT3_FLOOR1_QUEST_ID]: "active" } };
    for (const flag of [UNIT3_FLOOR1_FLAGS.startEvent, UNIT3_FLOOR1_FLAGS.cartRescue, ...UNIT3_FLOOR1_STORY_FLAGS, UNIT3_FLOOR1_FLAGS.postEventTalk]) s = markUnit3Flag(s, flag);
    return completeUnit3Floor1Quest(finishUnit3Floor1Run(s));
  })();
  assert(completedFloor1.questState[UNIT3_FLOOR1_QUEST_ID] === "completed" && getItemQuantity(completedFloor1.inventoryState, floor1.rewardItemId) === 0, "quest completion: no weapon (gold/potions only)");
  assert(!getUnit3SpecialRewardStatus(withCorrect(completedFloor1, UNIT3_FLOOR1_ID, 5), floor1).canClaim, "floor 1: 5 correct → cannot claim");
  const ready1 = withCorrect(completedFloor1, UNIT3_FLOOR1_ID, 6);
  assert(getUnit3SpecialRewardStatus(ready1, floor1).canClaim, "floor 1: 6 correct + quest completed → can claim");
  const notCompleted = withCorrect({ ...baseState(), questState: { ...baseState().questState, [UNIT3_FLOOR1_QUEST_ID]: "active" } }, UNIT3_FLOOR1_ID, 8);
  assert(!getUnit3SpecialRewardStatus(notCompleted, floor1).canClaim && claimUnit3SpecialReward(notCompleted, UNIT3_FLOOR1_ID) === notCompleted, "enough correct but quest not completed → cannot claim");
  const claimed = claimUnit3SpecialReward(ready1, UNIT3_FLOOR1_ID);
  const twice = claimUnit3SpecialReward(claimUnit3SpecialReward(claimed, UNIT3_FLOOR1_ID), UNIT3_FLOOR1_ID);
  assert(getItemQuantity(claimed.inventoryState, floor1.rewardItemId) === 1 && twice === claimed && claimed.rewardClaimed[unit3SpecialRewardKey(UNIT3_FLOOR1_ID)], "claim: weapon once, repeated clicks do nothing");
  assert(getUnit3SpecialRewardStatus(claimed, floor1).claimed && !getUnit3SpecialRewardStatus(claimed, floor1).canClaim, "claimed → 수령 완료");
  const claimedReloaded = applySaveDataToGameState(validateCurrentSave(JSON.parse(JSON.stringify(createSaveDataFromGameState(claimed))))!);
  assert(getUnit3SpecialRewardStatus(claimedReloaded, floor1).claimed && getItemQuantity(claimedReloaded.inventoryState, floor1.rewardItemId) === 1, "claim survives reload");
  // floor 2: 6 → no, 7 → yes
  const completedFloor2 = (() => {
    let s: GameSaveState = { ...claimed, questState: { ...claimed.questState, [UNIT3_FLOOR2_QUEST_ID]: "active" } };
    for (const flag of [UNIT3_FLOOR2_FLAGS.startEvent, UNIT3_FLOOR2_FLAGS.schoolBattle, ...UNIT3_FLOOR2_STORY_FLAGS, UNIT3_FLOOR2_FLAGS.postEventTalk, UNIT3_FLOOR2_FLAGS.finalStory]) s = markUnit3Flag(s, flag);
    return completeUnit3Floor2Quest(s);
  })();
  assert(completedFloor2.questState[UNIT3_FLOOR2_QUEST_ID] === "completed" && getItemQuantity(completedFloor2.inventoryState, floor2.rewardItemId) === 0, "floor 2 completion: no pen");
  assert(!getUnit3SpecialRewardStatus(withCorrect(completedFloor2, UNIT3_FLOOR2_ID, 6), floor2).canClaim, "floor 2: 6 correct → cannot claim");
  assert(getUnit3SpecialRewardStatus(withCorrect(completedFloor2, UNIT3_FLOOR2_ID, 7), floor2).canClaim, "floor 2: 7 correct → can claim");
  assert(getUnit3SpecialRewardStatus(completedFloor2, floor1).claimed, "floor 1 claim unaffected by floor 2");

  /* ---- 4. migration of pre-hotfix saves */
  const legacy1: GameSaveState = { ...completedFloor1, inventoryState: { ...completedFloor1.inventoryState, items: { ...completedFloor1.inventoryState.items, [floor1.rewardItemId]: 1 }, equippedItemIds: { ...completedFloor1.inventoryState.equippedItemIds, weaponSkin: floor1.rewardItemId } },
    firstObjectiveEventSeen: { ...completedFloor1.firstObjectiveEventSeen, [UNIT3_FLOOR1_FLAGS.hwandoUnlocked]: true } };
  const migrated = migrateUnit3SpecialRewards(legacy1);
  assert(migrated.rewardClaimed[unit3SpecialRewardKey(UNIT3_FLOOR1_ID)] && getItemQuantity(migrated.inventoryState, floor1.rewardItemId) === 1
    && migrated.inventoryState.equippedItemIds.weaponSkin === floor1.rewardItemId && migrated.questState[UNIT3_FLOOR1_QUEST_ID] === "completed", "legacy hwando: 수령 완료, item kept, still equipped, quest kept");
  assert(migrateUnit3SpecialRewards(migrated) === migrated, "migration idempotent");
  assert(claimUnit3SpecialReward(migrated, UNIT3_FLOOR1_ID) === migrated, "legacy owner cannot claim a second hwando");
  assert(getUnit3CorrectProgress(migrated, UNIT3_FLOOR1_ID) === 0, "no correct answers are invented for legacy saves");
  const legacyBest = { ...completedFloor1, floorBestCorrect: { [UNIT3_FLOOR1_ID]: 6 } };
  assert(getUnit3CorrectProgress(legacyBest, UNIT3_FLOOR1_ID) === 6 && getUnit3SpecialRewardStatus(legacyBest, floor1).canClaim, "legacy per-run best count is reused");
  const fresh = baseState();
  assert(migrateUnit3SpecialRewards(fresh) === fresh, "new players: nothing migrated");
  const ownedNoFlag = { ...completedFloor2, inventoryState: { ...completedFloor2.inventoryState, items: { ...completedFloor2.inventoryState.items, [floor2.rewardItemId]: 1 } } };
  assert(migrateUnit3SpecialRewards(ownedNoFlag).rewardClaimed[unit3SpecialRewardKey(UNIT3_FLOOR2_ID)], "pen owned after completion → 수령 완료");

  /* ---- 5. story-fight rooms: fought again in every new run; dialogue-only rooms stay resolved */
  for (const [floorId, prepare, apply, flags] of [
    [UNIT3_FLOOR1_ID, prepareUnit3Floor1Map, applyUnit3Floor1Progress, { [UNIT3_FLOOR1_FLAGS.startEvent]: true, [UNIT3_FLOOR1_FLAGS.cartRescue]: true, ...Object.fromEntries(UNIT3_FLOOR1_STORY_FLAGS.map((f) => [f, true])) }],
    [UNIT3_FLOOR2_ID, prepareUnit3Floor2Map, applyUnit3Floor2Progress, { [UNIT3_FLOOR2_FLAGS.startEvent]: true, [UNIT3_FLOOR2_FLAGS.schoolBattle]: true, ...Object.fromEntries(UNIT3_FLOOR2_STORY_FLAGS.map((f) => [f, true])) }],
  ] as const) {
    for (let n = 0; n < 10; n += 1) {
      const run = createDungeonRun(floorId as Parameters<typeof createDungeonRun>[0], `hotfix-rooms-${n}`);
      const map = prepare(run.map, run.seed);
      const fightRoom = findCartRoomId(map);
      const progress = apply(map, {}, flags);
      const room = map.rooms.find((candidate) => candidate.id === fightRoom)!;
      assert(room.type === "combat" && progress[fightRoom]?.eventCompleted !== true, `${floorId} seed ${n}: story-fight room is a normal fight in a new run`);
      assert(UNIT3_FLOOR1_STORY_ROOM_IDS.every((id) => !map.rooms.some((r) => r.id === id) || (progress[id]?.eventCompleted === true && map.rooms.find((r) => r.id === id)!.type === "empty")), `${floorId} seed ${n}: dialogue-only story rooms stay resolved, no monster added`);
      const final = map.rooms.find((candidate) => candidate.isFinalQuestRoom)!;
      assert(!final.combatConfig && !final.eliteConfig, `${floorId} seed ${n}: final room has no combat`);
      const questions = allocateDungeonRunQuestions(map, run.seed, floorId);
      assert(questions[fightRoom]?.length === 2, `${floorId} seed ${n}: story-fight room uses 2 questions from the run's random allocation`);
    }
  }

  /* ---- 6. 아부쟁이 친일파 portrait + 카프 placement */
  const sycophantLines = UNIT3_FLOOR2_ALL_STORIES.flatMap((story) => story.scenes.flatMap((scene) => scene.steps)).filter((step) => step.type === "dialogue" && step.speakerId === "sycophant");
  const actor = UNIT3_FLOOR2_ALL_STORIES.map((story) => story.actors.sycophant).find(Boolean);
  assert(sycophantLines.length > 0 && actor?.portraits.default?.imageUrl?.endsWith("floor2/portraits/sycophant.png"), "아부쟁이 친일파 speaks with the supplied portrait");
  assert(getMonsterVisualDefinition("unit3-f2-sycophant").image.endsWith("floor2/monsters/sycophant.png"), "combat image unchanged");
  assert(resolveKafPlacement("kaf", "beside") === "solo" && resolveKafPlacement("street-kaf", "solo") === "beside" && resolveKafPlacement("yard-kaf", "solo") === "beside", "카프: alone → centre, with an illustration → beside");
  assert(resolveKafPlacement("none", "solo") === "solo" && resolveKafPlacement("none", "beside") === "beside" && resolveKafPlacement("yard", "beside") === "beside", "카프 keeps her place while fading out");

  /* ---- 7. tram + dungeon BGM data */
  const tram = CHAPTER3_BASE_CAMP_MAP.tram!;
  assert(tram.firstDelaySeconds && rollTramDelayMs(0, tram.firstDelaySeconds) === 4000 && rollTramDelayMs(1, tram.firstDelaySeconds) === 8000, "tram: first pass 4–8 s");
  assert(rollTramDelayMs(0, tram.intervalSeconds) === 12000 && rollTramDelayMs(1, tram.intervalSeconds) === 22000 && tram.crossingSeconds === 12.5, "tram: 12–22 s after each 12.5 s pass");
  assert(BGM_URLS["unit3-dungeon"].endsWith("assets/audio/bgm/unit3-dungeon.wav") && BGM_LOUDNESS_TRIM["unit3-dungeon"] === 0.327, "dungeon BGM: file + loudness trim (-15.8 → -25.5 LUFS)");
  const region = BGM_LOOP_REGIONS["unit3-dungeon"]!;
  assert(region[0] === 1.4 && region[1] === 118.2 && region[1] < 119.616, "dungeon BGM loop region inside the file");
  assert(Math.abs(effectiveBgmVolume("unit3-dungeon") - 0.42 * 0.327) < 1e-9 && effectiveBgmVolume("unit3-basecamp") === 0.42 * 0.473, "dungeon BGM uses the shared 0.42 volume like the other themes");
}
