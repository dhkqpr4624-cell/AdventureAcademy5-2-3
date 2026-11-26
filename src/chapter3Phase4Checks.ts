import { createInitialGameSaveState, type GameSaveState } from "./save/saveStateAdapter";
import { FLOOR_QUESTION_POOLS } from "./data/floorQuestionPools";
import { createDungeonRun } from "./game/dungeon/generation/floor1DungeonRuntime";
import { getItemDefinition } from "./game/inventory/itemDefinitions";
import { getItemQuantity } from "./game/inventory/inventoryState";
import {
  UNIT3_FLOOR_ACHIEVEMENTS, completeUnit3QuestWithSpecialReward, getUnit3SpecialRewardStatus, recordUnit3CorrectAnswer, unit3SpecialRewardKey,
} from "./game/chapter3/unit3Achievements";
import { UNIT3_FLOOR1_STORY_ROOM_IDS, findCartRoomId, markUnit3Flag } from "./game/chapter3/unit3Floor1";
import { UNIT3_FLOOR2_ID, UNIT3_FLOOR2_QUEST_ID, completeUnit3Floor2Quest } from "./game/chapter3/unit3Floor2";
import {
  UNIT3_FLOOR3_ACHIEVEMENT, UNIT3_FLOOR3_FLAGS, UNIT3_FLOOR3_ID, UNIT3_FLOOR3_INVESTIGATION_PLACES, UNIT3_FLOOR3_MONSTER_IDS, UNIT3_FLOOR3_QUEST_ID,
  UNIT3_FLOOR3_REWARD, UNIT3_FLOOR3_STORY_FLAGS, acceptUnit3Floor3Quest, applyUnit3Floor3Progress, completeUnit3Floor3Quest, finishUnit3Floor3Run,
  getUnit3Floor3QuestPhase, getUnit3PendingFloorId, isKafAtBaseCamp, prepareUnit3Floor3Map,
} from "./game/chapter3/unit3Floor3";
import { UNIT3_FLOOR3_QUESTIONS, UNIT3_FLOOR3_QUESTIONS_ARE_INTERIM } from "./data/chapter3/floor3Questions";
import {
  UNIT3_FLOOR3_ALL_STORIES, UNIT3_FLOOR3_EVENT_MAP_SEGMENTS, UNIT3_FLOOR3_QUEST_ACCEPTED_CHECKPOINT, UNIT3_FLOOR3_QUEST_OFFER_STORY, UNIT3_KAF_BASE_TALK_STORY,
} from "./data/chapter3/floor3Stories";
import { getUnit3StoryFloor } from "./game/chapter3/unit3StoryFloors";
import { resolveFloor3KafPlacement } from "./game/chapter3/Unit3Floor3Stage";
import { U3EM_FOG_CONTACT_FRONT, U3EM_LAYOUT, U3EM_POSES, poseVisibleWidth } from "./game/chapter3/eventMap/Unit3Floor3EventMap";
import { getMonsterVisualDefinition } from "./game/monster/monsterDefinitions";
import { CHAPTER3_BASE_CAMP_MAP, createChapter3BaseCampHitboxes, createChapter3BaseCampNpcs } from "./data/chapter3/chapter3BaseCamp";
import { GATE_OUTLINE_STEPS, NPC_OUTLINE_STEPS } from "./components/outlineMask";
import { evaluateEmergencySupply } from "./game/chapter3/emergencySupply";
import { CHAPTER3_STAGE_SPRITES } from "./data/chapter3/chapter3Actors";
import { UNIT3_DEBUG_FLOORS, createUnit3DebugStart } from "./debug/unit3DebugStart";

/** Phase 4 checks: Floor 3 data/flow, special-reward auto grant, pen rename, entrance strip, outlines, 카프 joining, event map layout. */
const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(`[chapter3 phase4] ${message}`); };

const base = (): GameSaveState => {
  const initial = createInitialGameSaveState();
  return { ...initial, playerState: { ...initial.playerState, name: "지지" } };
};
const withFlags = (state: GameSaveState, ...flags: string[]) => flags.reduce((acc, flag) => markUnit3Flag(acc, flag), state);
const floor2Completed = (): GameSaveState => {
  const state = base();
  return { ...state, questState: { ...state.questState, [UNIT3_FLOOR2_QUEST_ID]: "completed", "quest-unit3-floor-1": "completed" }, rewardClaimed: { ...state.rewardClaimed, [UNIT3_FLOOR2_QUEST_ID]: true } };
};

export function runChapter3Phase4Checks(): void {
  /* ---- pen rename (id kept) */
  const pen = getItemDefinition("weapon-learning-fountain-pen");
  assert(pen?.name === "애국계몽 만년필", "pen renamed, id unchanged");

  /* ---- special reward auto-grant at the report (all floors) */
  const f3spec = UNIT3_FLOOR_ACHIEVEMENTS.find((spec) => spec.floorId === UNIT3_FLOOR3_ID);
  assert(f3spec && f3spec.requiredCorrect === 7 && f3spec.rewardItemId === "decor-taken-land-deed", "floor 3 special reward: 빼앗긴 땅문서, 7 questions");
  assert(UNIT3_FLOOR_ACHIEVEMENTS.map((spec) => spec.requiredCorrect).join(",") === "6,7,7", "requirements 6 / 7 / 7");
  const ids = UNIT3_FLOOR3_QUESTIONS.map((question) => question.id);
  const ready3 = (correct: number) => {
    let state = withFlags(acceptUnit3Floor3Quest(floor2Completed()), UNIT3_FLOOR3_FLAGS.finalStory);
    for (let i = 0; i < correct; i++) state = recordUnit3CorrectAnswer(state, UNIT3_FLOOR3_ID, ids[i]);
    return state;
  };
  const met = completeUnit3QuestWithSpecialReward(ready3(7), UNIT3_FLOOR3_ID, completeUnit3Floor3Quest);
  assert(getItemQuantity(met.inventoryState, "decor-taken-land-deed") === 1 && met.rewardClaimed[unit3SpecialRewardKey(UNIT3_FLOOR3_ID)], "condition met at report → item granted with the quest reward");
  assert(getUnit3SpecialRewardStatus(met, f3spec!).claimed && !getUnit3SpecialRewardStatus(met, f3spec!).canClaim, "achievement window shows 수령 완료");
  const again = completeUnit3QuestWithSpecialReward(met, UNIT3_FLOOR3_ID, completeUnit3Floor3Quest);
  assert(again === met, "second report: nothing twice");
  const short = completeUnit3QuestWithSpecialReward(ready3(6), UNIT3_FLOOR3_ID, completeUnit3Floor3Quest);
  assert(getItemQuantity(short.inventoryState, "decor-taken-land-deed") === 0 && short.playerState.gold === ready3(6).playerState.gold + UNIT3_FLOOR3_REWARD.gold, "condition not met → gold/potions only");
  assert(short.achievementReceived[UNIT3_FLOOR3_ACHIEVEMENT.id] && short.questState[UNIT3_FLOOR3_QUEST_ID] === "completed", "achievement + completion without the item");
  const later = recordUnit3CorrectAnswer(short, UNIT3_FLOOR3_ID, ids[6]);
  assert(getUnit3SpecialRewardStatus(later, f3spec!).canClaim, "받기 available once the 7th distinct answer is recorded");
  // Floor 2 report with the condition met also grants immediately (applies to every floor).
  let f2 = withFlags({ ...base(), questState: { ...base().questState, "quest-unit3-floor-1": "completed", [UNIT3_FLOOR2_QUEST_ID]: "active" } }, "unit3-floor-2:final-story");
  const f2ids = [...(FLOOR_QUESTION_POOLS as Record<string, readonly { id: string }[]>)[UNIT3_FLOOR2_ID]].map((q) => q.id);
  for (let i = 0; i < 7; i++) f2 = recordUnit3CorrectAnswer(f2, UNIT3_FLOOR2_ID, f2ids[i]);
  const f2done = completeUnit3QuestWithSpecialReward(f2, UNIT3_FLOOR2_ID, completeUnit3Floor2Quest);
  assert(getItemQuantity(f2done.inventoryState, "weapon-learning-fountain-pen") === 1, "floor 2 report grants the pen when 7/7");

  /* ---- floor 3 data */
  assert(UNIT3_FLOOR3_QUESTIONS_ARE_INTERIM === true && UNIT3_FLOOR3_QUESTIONS.length >= 20, "floor 3 questions: interim pool (separate module), enough for a run");
  assert((FLOOR_QUESTION_POOLS as Record<string, unknown>)[UNIT3_FLOOR3_ID] === UNIT3_FLOOR3_QUESTIONS, "floor 3 pool registered");
  const kenpei = getMonsterVisualDefinition(UNIT3_FLOOR3_MONSTER_IDS.kenpei);
  const watcher = getMonsterVisualDefinition(UNIT3_FLOOR3_MONSTER_IDS.watcher);
  assert(kenpei.name === "일본제국의 헌병" && watcher.name === "조선총독부 감시자", "floor 3 monster names");
  assert(getItemDefinition("decor-taken-land-deed")?.equipmentStats === undefined, "land deed: decoration, no stats");

  /* ---- layout over many seeds: start → mid (dialogue only) → 3 story rooms → final; only 헌병 / 감시자 */
  for (let n = 0; n < 40; n++) {
    const run = createDungeonRun(UNIT3_FLOOR3_ID as Parameters<typeof createDungeonRun>[0], `p4-${n}`);
    const map = prepareUnit3Floor3Map(run.map, run.seed);
    const mid = findCartRoomId(map);
    assert(mid !== map.startRoomId, `seed ${n}: mid room is the start's only exit (findCartRoomId throws otherwise)`);
    assert(map.rooms.find((room) => room.id === mid)!.type === "empty", `seed ${n}: mid room has no fight`);
    for (const id of UNIT3_FLOOR1_STORY_ROOM_IDS) assert(map.rooms.find((room) => room.id === id)?.type === "empty", `seed ${n}: story room ${id} is dialogue only`);
    assert(map.rooms.some((room) => room.isFinalQuestRoom), `seed ${n}: final room`);
    const monsters = new Set(map.rooms.flatMap((room) => [room.combatConfig?.monsterId, room.eliteConfig?.monsterId]).filter(Boolean));
    assert([...monsters].every((id) => id === UNIT3_FLOOR3_MONSTER_IDS.kenpei || id === UNIT3_FLOOR3_MONSTER_IDS.watcher), `seed ${n}: only floor 3 monsters`);
    assert(map.rooms.some((room) => room.type === "elite"), `seed ${n}: at least one elite`);
    const progress = applyUnit3Floor3Progress(map, {}, { [UNIT3_FLOOR3_FLAGS.midEvent]: true });
    assert(progress[mid].eventCompleted && !progress[UNIT3_FLOOR1_STORY_ROOM_IDS[0]].eventCompleted, `seed ${n}: room state from permanent flags`);
  }

  /* ---- registry / flow config */
  const floor = getUnit3StoryFloor(UNIT3_FLOOR3_ID)!;
  assert(floor.mainEventFightless && typeof floor.renderFinal === "function" && floor.investigationPlaces?.join("/") === UNIT3_FLOOR3_INVESTIGATION_PLACES.join("/"), "floor 3 registry: fightless mid, event map, 조사 현황");
  assert(floor.flags.mainFight === UNIT3_FLOOR3_FLAGS.midEvent && floor.storyFlags === UNIT3_FLOOR3_STORY_FLAGS, "floor 3 flags");
  // 6 orders of the three story rooms all reach the post-event talk exactly once
  const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (const order of orders) {
    let flags: Record<string, boolean> = {};
    let postTalks = 0;
    for (const index of order) {
      flags = { ...flags, [UNIT3_FLOOR3_STORY_FLAGS[index]]: true };
      const all = UNIT3_FLOOR3_STORY_FLAGS.every((flag) => flags[flag]);
      if (all && !flags[UNIT3_FLOOR3_FLAGS.postEventTalk]) { postTalks += 1; flags[UNIT3_FLOOR3_FLAGS.postEventTalk] = true; }
    }
    assert(postTalks === 1, `order ${order.join("")}: post-event talk once`);
  }

  /* ---- script structure */
  const offerSteps = UNIT3_FLOOR3_QUEST_OFFER_STORY.scenes[0].steps;
  const choice = offerSteps.find((step) => step.type === "choice");
  assert(choice && "options" in choice && choice.options?.map((option) => option.label).join("|") === "함께 조사하겠습니다.|잠시 준비하겠습니다.", "offer choices ① / ②");
  assert(offerSteps.some((step) => step.type === "checkpoint" && step.checkpointId === UNIT3_FLOOR3_QUEST_ACCEPTED_CHECKPOINT), "accept checkpoint");
  assert(offerSteps.filter((step) => step.type === "dialogue").every((step) => step.speakerId === "kaiden" || step.speakerId === "deneb"), "offer: 카이든 / 데네브");
  assert(Object.keys(UNIT3_FLOOR3_EVENT_MAP_SEGMENTS).length === 8 && UNIT3_FLOOR3_ALL_STORIES.length === 17, "every script segment implemented (offer, start, mid, 3 rooms, post, 8 event-map parts, report, 카프)");
  for (const story of UNIT3_FLOOR3_ALL_STORIES) {
    for (const step of story.scenes[0].steps) {
      if (step.type === "dialogue") assert(story.actors[step.speakerId ?? ""], `${story.id}: actor ${step.speakerId}`);
      const text = "text" in step ? String(step.text ?? "") : "";
      assert(!text.replace("(플레이어 이름)", "").trimStart().startsWith("("), `${story.id}: no stage direction shown as a line`);
    }
  }
  assert(UNIT3_KAF_BASE_TALK_STORY.scenes[0].steps.length === 2, "카프 basic talk: 2 lines");

  /* ---- 카프 placement rule (alone centred / beside illustration) */
  assert(resolveFloor3KafPlacement("street-kaf", "solo") === "beside" && resolveFloor3KafPlacement("kaf", "beside") === "solo" && resolveFloor3KafPlacement("none", "beside") === "beside", "카프 placement rule");

  /* ---- quest phases, 카프 joining, emergency supply */
  assert(getUnit3Floor3QuestPhase(base()) === "locked" && getUnit3Floor3QuestPhase(floor2Completed()) === "notAccepted", "floor 3 offered after floor 2");
  const accepted = acceptUnit3Floor3Quest(floor2Completed());
  assert(accepted.questState[UNIT3_FLOOR3_QUEST_ID] === "active" && accepted.floorUnlockState.unlockedFloorIds.includes(UNIT3_FLOOR3_ID), "accept unlocks floor 3");
  assert(acceptUnit3Floor3Quest(accepted) === accepted, "accept idempotent");
  assert(getUnit3PendingFloorId(accepted) === UNIT3_FLOOR3_ID, "emergency supply targets floor 3");
  void evaluateEmergencySupply(accepted);
  assert(!isKafAtBaseCamp(accepted), "카프 not at camp before the event map");
  const finished = finishUnit3Floor3Run(accepted);
  assert(isKafAtBaseCamp(finished) && finished.firstObjectiveEventSeen[UNIT3_FLOOR3_FLAGS.kafMemoryRestored] && getUnit3Floor3QuestPhase(finished) === "readyToComplete", "event map end: 카프 joined + memory, report ready");
  assert(finished.playerState.currentHp === finished.playerState.maxHp && finished.currentFloorRun === null, "full HP, run cleared");
  assert(isKafAtBaseCamp(completeUnit3Floor3Quest(finished)), "카프 stays after the report");

  /* ---- base camp: 카프 NPC (no duplicates), hitbox, role */
  const npcs = createChapter3BaseCampNpcs({ kaf: true });
  assert(npcs.filter((npc) => npc.id === "kaf").length === 1 && npcs.find((npc) => npc.id === "kaf")!.displayRole === "부지휘관", "카프 NPC once, 부지휘관");
  assert(createChapter3BaseCampHitboxes(npcs).kaf && !createChapter3BaseCampHitboxes(createChapter3BaseCampNpcs()).kaf, "카프 hitbox only when joined");
  assert(npcs.find((npc) => npc.id === "kaf")!.idle.standingImage === CHAPTER3_STAGE_SPRITES.kapp.images.R, "카프 uses the original outfit standing");

  /* ---- hover outlines / entrance animation */
  assert(NPC_OUTLINE_STEPS.length === 8 && GATE_OUTLINE_STEPS.length === 4, "outline steps match the previous drop-shadow chains");
  const anim = CHAPTER3_BASE_CAMP_MAP.dungeonEntranceAnimation;
  assert(anim && anim.frames === 12 && anim.fps === 8 && anim.region.w === 338 && anim.region.h === 199, "entrance strip: 12 frames, 8 fps, masked region");

  /* ---- event map layout: fog stops before the defenders; defenders face left of centre */
  assert(U3EM_FOG_CONTACT_FRONT < U3EM_LAYOUT.barrierX && U3EM_LAYOUT.barrierX < U3EM_LAYOUT.defenders.deneb && U3EM_LAYOUT.defenders.deneb < U3EM_LAYOUT.defenders.kaf, "fog → barrier → 데네브 → 카프 (left to right)");
  for (const [id, pose] of Object.entries(U3EM_POSES)) assert(pose.bottom > pose.top && pose.bottom <= pose.h, `pose ${id}: alpha box`);

  /* ---- Phase 4 hotfix: event map layout (visible boxes never overlap in the scripted rows) + Debug Mode starts */
  const row = (positions: Record<string, number>, poses: Record<string, keyof typeof U3EM_POSES>) => {
    const boxes = Object.entries(positions).map(([id, x]) => ({ id, l: x - poseVisibleWidth(poses[id]) / 2, r: x + poseVisibleWidth(poses[id]) / 2 })).sort((a, b) => a.l - b.l);
    for (let i = 1; i < boxes.length; i++) assert(boxes[i].l - boxes[i - 1].r >= 15, `event map: ${boxes[i - 1].id} / ${boxes[i].id} overlap`);
  };
  const standing = { deneb: "deneb", kaf: "kafAcademy", kaiden: "kaiden", student: "student", official: "official", resident1: "resident1", resident2: "resident2" } as const;
  row(U3EM_LAYOUT.entrance, standing);
  row(U3EM_LAYOUT.safeAlley, standing);
  row({ deneb: U3EM_LAYOUT.defenders.deneb, kaf: U3EM_LAYOUT.defenders.kaf }, { deneb: "denebDefense", kaf: "kafDefense" });
  row({ deneb: U3EM_LAYOUT.defenders.deneb + 25, kaf: U3EM_LAYOUT.defenders.kaf }, { deneb: "deneb", kaf: "kafAcademy" });
  assert(Object.keys(U3EM_LAYOUT.safeAlley).length === 7, "safe alley: all seven people");
  assert(!("kafPeriod" in U3EM_POSES), "event map: 카프 only in her academy outfit");

  assert(UNIT3_DEBUG_FLOORS.map((floor) => floor.floorId).join(",") === "unit3-floor-1,unit3-floor-2,unit3-floor-3", "debug floors = implemented floors");
  const early = createUnit3DebugStart(UNIT3_FLOOR3_ID, "early");
  assert(early.floorRun === null && getUnit3Floor3QuestPhase(early.state) === "notAccepted" && !isKafAtBaseCamp(early.state), "debug 3층 초반: quest offerable, 카프 not joined");
  assert(early.state.questState["quest-unit3-floor-1"] === "completed" && early.state.questState[UNIT3_FLOOR2_QUEST_ID] === "completed", "debug 초반: floors 1–2 completed");
  for (const spec of UNIT3_FLOOR_ACHIEVEMENTS.slice(0, 2)) {
    const status = getUnit3SpecialRewardStatus(early.state, spec);
    assert(status.claimed && getItemQuantity(early.state.inventoryState, spec.rewardItemId) === 1 && early.state.achievementReceived[spec.achievement.id] === true, `debug 초반: ${spec.floorId} special reward + correct answers`);
  }
  const late = createUnit3DebugStart(UNIT3_FLOOR3_ID, "late");
  const lateFlags = late.state.firstObjectiveEventSeen;
  assert(late.state.questState[UNIT3_FLOOR3_QUEST_ID] === "active" && [UNIT3_FLOOR3_FLAGS.startEvent, UNIT3_FLOOR3_FLAGS.midEvent, ...UNIT3_FLOOR3_STORY_FLAGS, UNIT3_FLOOR3_FLAGS.postEventTalk].every((flag) => lateFlags[flag]), "debug 후반: accepted, every story before the final room");
  assert(!lateFlags[UNIT3_FLOOR3_FLAGS.finalStory] && !isKafAtBaseCamp(late.state) && !late.state.rewardClaimed[UNIT3_FLOOR3_QUEST_ID], "debug 후반: final event / 카프 / reward untouched");
  const lateRun = late.floorRun!;
  const lateMap = prepareUnit3Floor3Map(createDungeonRun(UNIT3_FLOOR3_ID as Parameters<typeof createDungeonRun>[0], lateRun.seed).map, lateRun.seed);
  const finalId = lateMap.rooms.find((room) => room.isFinalQuestRoom)!.id;
  assert(!lateRun.roomProgress[finalId].eventCompleted && Object.values(lateRun.roomProgress).filter((p) => !p.eventCompleted).length === 1, "debug 후반: only the final room left");
  assert(lateMap.connections.some((c) => (c.fromRoomId === finalId && c.toRoomId === lateRun.currentRoomId) || (c.toRoomId === finalId && c.fromRoomId === lateRun.currentRoomId)), "debug 후반: player next to the final room");
  assert(late.state.playerState.currentHp === late.state.playerState.maxHp && getItemQuantity(late.state.inventoryState, "potion-small") >= 5, "debug: HP / potions");
  for (const floor of UNIT3_DEBUG_FLOORS) { createUnit3DebugStart(floor.floorId, "early"); createUnit3DebugStart(floor.floorId, "late"); }
}
