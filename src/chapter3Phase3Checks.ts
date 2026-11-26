import floor2Script from "../docs/chapter3/floor2-script-phase3.txt?raw";
import type { DungeonRoomProgress } from "./game/dungeon/dungeonTypes";
import { createDungeonRun } from "./game/dungeon/generation/floor1DungeonRuntime";
import { allocateDungeonRunQuestions } from "./game/dungeon/dungeonRunQuestionAllocator";
import { canEnterFinalRoom, isFinalRoom } from "./game/dungeon/dungeonExplorationResolver";
import { UNIT3_FLOOR1_FLAGS, UNIT3_FLOOR1_ID, UNIT3_FLOOR1_QUEST_ID, findCartRoomId, prepareUnit3Floor1Map } from "./game/chapter3/unit3Floor1";
import {
  UNIT3_FLOOR2_ACHIEVEMENT, UNIT3_FLOOR2_FLAGS, UNIT3_FLOOR2_ID, UNIT3_FLOOR2_MONSTER_IDS, UNIT3_FLOOR2_QUEST_ID, UNIT3_FLOOR2_QUEST_TITLE,
  UNIT3_FLOOR2_REWARD, UNIT3_FLOOR2_STORY_FLAGS, UNIT3_FLOOR2_STORY_ROOM_IDS, UNIT3_FLOOR2_TITLE, acceptUnit3Floor2Quest, applyUnit3Floor2Progress,
  completeUnit3Floor2Quest, finishUnit3Floor2Run, getUnit3Floor2QuestPhase, getUnit3TargetFloorId, prepareUnit3Floor2Map,
} from "./game/chapter3/unit3Floor2";
import { UNIT3_FLOOR2_ALL_STORIES, UNIT3_FLOOR2_FINAL_STORY, UNIT3_FLOOR2_ILLUST, UNIT3_FLOOR2_KAF_STANDING, UNIT3_FLOOR2_STORY_ROOM_STORIES } from "./data/chapter3/floor2Stories";
import { UNIT3_FLOOR2_STAGE_PHASES } from "./game/chapter3/Unit3Floor2Stage";
import { UNIT3_STORY_FLOORS, getUnit3StoryFloor } from "./game/chapter3/unit3StoryFloors";
import { getUnit3MonsterAttackVfx, getUnit3MonsterDefeatVfx } from "./game/chapter3/Unit3MonsterAttackVfx";
import { EMERGENCY_SUPPLY_STORY } from "./data/chapter3/emergencySupplyStory";
import { applyEmergencySupply, evaluateEmergencySupply, expectedCombatDamage } from "./game/chapter3/emergencySupply";
import { getMonsterVisualDefinition } from "./game/monster/monsterDefinitions";
import { getItemDefinition } from "./game/inventory/itemDefinitions";
import { getSwordDefinitionForEquippedItem } from "./three/weapon/SwordViewModel";
import { UIBYEONG_HWANDO_SLASH_VFX } from "./game/combat/attackVfxDefinitions";
import { DUNGEON_FLOOR_TITLES } from "./data/DungeonFloorTitles";
import { FLOOR_QUESTION_POOLS, UNIT3_FLOOR1_INTERIM_QUESTIONS, UNIT3_FLOOR2_INTERIM_QUESTIONS } from "./data/floorQuestionPools";
import { planGyeongseongLayout, toGyeongseongVisualMap } from "./three/dungeon/gyeongseong/gyeongseongLayout";
import { WARP_FLASH_LEVEL } from "./game/audio/chapter3ProceduralSfx";
import { applySaveDataToGameState, createInitialGameSaveState, createSaveDataFromGameState, type GameSaveState } from "./save/saveStateAdapter";
import { validateCurrentSave } from "./save/saveSchema";
import { getItemQuantity } from "./game/inventory/inventoryState";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[chapter3 phase3] ${message}`);
}

const PERMUTATIONS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

const floor1Completed = (): GameSaveState => {
  const state = createInitialGameSaveState();
  return { ...state, questState: { ...state.questState, [UNIT3_FLOOR1_QUEST_ID]: "completed" }, firstObjectiveEventSeen: { [UNIT3_FLOOR1_FLAGS.finalStory]: true, [UNIT3_FLOOR1_FLAGS.questCompleted]: true } };
};

export function runChapter3Phase3Checks(): void {
  /* 1. Floor 2 script fidelity: order, speaker, expression, text and choices, nothing missing or extra */
  type Line = { kind: "line"; speaker: string; expression: string; text: string } | { kind: "choice"; text: string };
  const SPEAKERS = ["데네브", "카이든", "카프", "학교 관계자", "아부쟁이 친일파", "학생", "주민", "다른 주민"];
  const scriptLines: Line[] = [];
  let speaker: string | null = null, expression = "default";
  for (const raw of floor2Script.slice(0, floor2Script.indexOf("[퀘스트 보상]")).split("\n")) {
    const line = raw.trim();
    const header = /^(.+?)\s*(?:\((\w+)\))?$/.exec(line);
    const quoted = /^"(.*)"$/.exec(line);
    const choice = /^[①②]\s*"(.*)"$/.exec(line);
    if (choice) { scriptLines.push({ kind: "choice", text: choice[1].trim() }); speaker = null; continue; }
    if (quoted) { assert(speaker !== null, `script line without a speaker: ${line}`); scriptLines.push({ kind: "line", speaker, expression, text: quoted[1].trim() }); continue; }
    if (line === "dialogue") { speaker = "narration"; expression = "-"; continue; }
    if (header && SPEAKERS.includes(header[1])) { speaker = header[1]; expression = header[2] ?? "default"; continue; }
    if (line) speaker = null;
  }
  const storyLines: Line[] = UNIT3_FLOOR2_ALL_STORIES.flatMap((story) => story.scenes.flatMap((scene) => scene.steps)).flatMap((step): Line[] => {
    if (step.type === "dialogue") return [{ kind: "line", speaker: step.speakerName ?? "", expression: step.expression ?? "default", text: step.text }];
    if (step.type === "narration") return [{ kind: "line", speaker: "narration", expression: "-", text: step.text }];
    if (step.type === "choice") return step.options.map((option) => ({ kind: "choice" as const, text: option.label }));
    return [];
  });
  assert(scriptLines.length === storyLines.length, `floor 2 script has ${scriptLines.length} lines/choices, stories have ${storyLines.length}`);
  scriptLines.forEach((expected, index) => assert(JSON.stringify(storyLines[index]) === JSON.stringify(expected), `floor 2 line ${index + 1}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(storyLines[index])}`));
  for (const story of UNIT3_FLOOR2_ALL_STORIES) {
    for (const step of story.scenes.flatMap((scene) => scene.steps)) {
      if (step.type === "setStagePhase") assert(step.phase in UNIT3_FLOOR2_STAGE_PHASES, `${story.id}: unknown stage phase ${step.phase}`);
      if (step.type === "dialogue" || step.type === "narration") assert(!/※|illust|fade|standing|sfx|\(던전|\(대화|\(베이스/.test(step.text), `${story.id}: stage direction shown as dialogue: ${step.text}`);
    }
  }
  assert(UNIT3_FLOOR2_STORY_ROOM_STORIES.length === 3 && new Set(UNIT3_FLOOR2_ALL_STORIES.map((story) => story.id)).size === UNIT3_FLOOR2_ALL_STORIES.length, "three story rooms, no duplicated event (the doubled event-1 heading creates one event)");
  console.info(`  floor 2 script: ${scriptLines.length} lines/choices match the script (order, speaker, expression, text)`);
  // 카프: standing shown only through the stage, never a party member / base camp NPC; final choice merges
  const finalSteps = UNIT3_FLOOR2_FINAL_STORY.scenes[0].steps;
  const finalChoice = finalSteps.find((step) => step.type === "choice");
  assert(finalChoice?.type === "choice" && finalChoice.options.length === 2, "final room: two story choices");
  const merge = finalSteps.find((step) => step.id === "u3f2-final-merge");
  assert(merge?.type === "dialogue" && finalChoice.options.every((option) => finalSteps.find((step) => step.id === option.nextStepId)?.type === "dialogue"), "final choice: each answer has its line, then both merge");
  assert(Object.values(UNIT3_FLOOR2_STAGE_PHASES).filter((phase) => phase.kaf).length >= 3 && UNIT3_FLOOR2_KAF_STANDING.endsWith("floor2/standing/kaf-period.png"), "카프 period standing on the stage");
  assert(Object.keys(UNIT3_FLOOR2_ILLUST).length === 6, "six supplied illustrations");
  const kaf = UNIT3_FLOOR2_FINAL_STORY.actors.kaf;
  // Phase 4 hotfix 2: on Floor 2 (before her memory returns) 카프 uses the supplied 개화기-costume portraits.
  assert(kaf.name === "카프" && ["default", "smile", "serious", "angry"].every((expression) => kaf.portraits[expression]?.imageUrl?.endsWith(`kaf-period/${expression}.png`)), "카프 (Floor 2): 개화기-costume expression portraits");

  /* 2. titles, monsters, items, achievement, VFX contracts */
  assert(DUNGEON_FLOOR_TITLES.find((entry) => entry.floorId === UNIT3_FLOOR2_ID)?.subtitle === UNIT3_FLOOR2_TITLE && UNIT3_FLOOR2_TITLE === "일제 침략에 맞선 다양한 노력(애국계몽운동과 의거 활동)", "floor 2 title");
  assert(UNIT3_FLOOR2_QUEST_TITLE === "우리를 잊은 동료", "floor 2 quest title");
  assert(getMonsterVisualDefinition(UNIT3_FLOOR2_MONSTER_IDS.sycophant).name === "아부쟁이 친일파" && getMonsterVisualDefinition(UNIT3_FLOOR2_MONSTER_IDS.informer).name === "밀고하는 그림자"
    && getMonsterVisualDefinition(UNIT3_FLOOR2_MONSTER_IDS.elite).name === "이토 히로부미의 망령", "floor 2 monster names");
  for (const id of Object.values(UNIT3_FLOOR2_MONSTER_IDS)) assert(getUnit3MonsterAttackVfx(id)?.startsWith("floor2/vfx/"), `${id}: PixelFX attack VFX`);
  assert(getUnit3MonsterDefeatVfx(UNIT3_FLOOR2_MONSTER_IDS.sycophant) === "floor2/vfx/sycophant-black-smoke" && getUnit3MonsterDefeatVfx(UNIT3_FLOOR2_MONSTER_IDS.informer) === null, "black smoke on 아부쟁이 친일파 defeat only");
  const pen = getItemDefinition(UNIT3_FLOOR2_REWARD.weaponItemId)!;
  assert(pen.name === "애국계몽 만년필" /* Phase 4 rename */ && pen.type === "weaponSkin" && pen.attackVfxId === "ink-brush-attack" && !pen.equipmentStats, "애국계몽 만년필 (id unchanged): cosmetic, existing ink-brush VFX");
  assert(pen.description === "책과 배움으로 나라를 지키려 했던 사람들의 뜻을 담은 무기.", "pen description");
  assert(getSwordDefinitionForEquippedItem(pen.id).textureUrl.endsWith("assets/swords/learning-fountain-pen.png"), "pen texture on the existing weapon model");
  const hwando = getItemDefinition("weapon-uibyeong-hwando")!;
  assert(hwando.attackVfxId === UIBYEONG_HWANDO_SLASH_VFX.id && UIBYEONG_HWANDO_SLASH_VFX.sheetWidth === 8 * UIBYEONG_HWANDO_SLASH_VFX.frameWidth && UIBYEONG_HWANDO_SLASH_VFX.frameCount === 8, "환도 uses its own 8-frame PixelFX slash");
  assert(getItemDefinition("weapon-basic-sword")!.attackVfxId === undefined && getItemDefinition("weapon-wooden-wand")!.attackVfxId === "fire-attack", "other weapons keep their VFX");
  assert(UNIT3_FLOOR2_ACHIEVEMENT.title === "잊혀도 남은 마음" && UNIT3_FLOOR2_ACHIEVEMENT.description === "기억을 잃고도 사람들을 지키고 있던 카프를 만났다.", "floor 2 achievement");
  assert(FLOOR_QUESTION_POOLS[UNIT3_FLOOR2_ID] === UNIT3_FLOOR2_INTERIM_QUESTIONS && UNIT3_FLOOR2_INTERIM_QUESTIONS === UNIT3_FLOOR1_INTERIM_QUESTIONS, "floor 2 questions: interim pool, one constant to replace");
  assert(WARP_FLASH_LEVEL > 0 && WARP_FLASH_LEVEL <= 0.06, "warp collapse level lowered");

  /* 3. floor 2 layout over many seeds: same structure as floor 1, gates for all 6 orders, combat-free final */
  for (let n = 0; n < 40; n += 1) {
    const run = createDungeonRun(UNIT3_FLOOR2_ID, `phase3-check-${n}`);
    const map = prepareUnit3Floor2Map(run.map, run.seed);
    const school = findCartRoomId(map);
    const schoolRoom = map.rooms.find((room) => room.id === school)!;
    assert(schoolRoom.type === "combat" && schoolRoom.isRequired && schoolRoom.combatConfig?.monsterId === UNIT3_FLOOR2_MONSTER_IDS.sycophant, `seed ${n}: school fight with 아부쟁이 친일파`);
    for (const storyId of UNIT3_FLOOR2_STORY_ROOM_IDS) {
      const room = map.rooms.find((candidate) => candidate.id === storyId);
      assert(room && room.type === "empty" && room.isRequired, `seed ${n}: ${storyId} is a required empty story room`);
    }
    const final = map.rooms.find((room) => room.isFinalQuestRoom)!;
    assert(final.type === "quest" && !final.combatConfig && !final.eliteConfig, `seed ${n}: final room has no combat`);
    assert(map.rooms.some((room) => room.type === "elite" && room.eliteConfig?.monsterId === UNIT3_FLOOR2_MONSTER_IDS.elite), `seed ${n}: an elite 이토 히로부미의 망령 exists`);
    assert(map.rooms.filter((room) => room.type === "combat").every((room) => [UNIT3_FLOOR2_MONSTER_IDS.sycophant, UNIT3_FLOOR2_MONSTER_IDS.informer].includes(room.combatConfig!.monsterId as never)), `seed ${n}: floor 2 normal monsters only`);
    const questions = allocateDungeonRunQuestions(map, run.seed, UNIT3_FLOOR2_ID);
    assert(map.rooms.filter((room) => room.type === "combat" || room.type === "elite").every((room) => (questions[room.id]?.length ?? 0) > 0), `seed ${n}: every combat room has questions`);
    assert(!canEnterFinalRoom(map, applyUnit3Floor2Progress(map, {}, {})), `seed ${n}: final gated at start`);
    for (const order of PERMUTATIONS) {
      let flags: Record<string, boolean> = { [UNIT3_FLOOR2_FLAGS.startEvent]: true, [UNIT3_FLOOR2_FLAGS.schoolBattle]: true };
      let progress: Record<string, DungeonRoomProgress> = applyUnit3Floor2Progress(map, {}, flags);
      order.forEach((storyIndex, position) => {
        assert(!canEnterFinalRoom(map, progress), `seed ${n} order ${order}: gated before story ${position + 1}`);
        flags = { ...flags, [UNIT3_FLOOR2_STORY_FLAGS[storyIndex]]: true };
        progress = applyUnit3Floor2Progress(map, progress, flags);
      });
      // Phase 3 hotfix: the school fight is not resolved by its permanent flag — it is fought again in every run.
      assert(progress[school]?.eventCompleted !== true && !canEnterFinalRoom(map, progress), `seed ${n} order ${order}: school room not resolved by the flag (fought again this run)`);
      progress = { ...progress, [school]: { roomId: school, eventCompleted: true } };
      assert(canEnterFinalRoom(map, progress) && isFinalRoom(map, final.id), `seed ${n} order ${order}: final open after all three + this run's school fight`);
    }
    // street profile: same graph and sizes, re-arranged buildings, no tram rails, never 12a
    const visual = toGyeongseongVisualMap(map);
    const school2 = planGyeongseongLayout(visual, run.seed, "floor2-school");
    const street1 = planGyeongseongLayout(visual, run.seed, "floor1");
    assert(school2.buildings.length > 20 && !school2.buildings.some((building) => building.model === "gs-station"), `seed ${n}: school district buildings`);
    assert(!school2.tiles.some((tile) => tile.tile === "road-tram") && school2.open.size === street1.open.size, `seed ${n}: same streets, no tram rails`);
    assert(JSON.stringify(school2.buildings) !== JSON.stringify(street1.buildings), `seed ${n}: floor 2 arrangement differs from floor 1`);
    for (const building of school2.buildings) for (const cell of building.cells) assert(!school2.open.has(cell), `seed ${n}: building on the street`);
  }
  // floor 1 layout untouched by the profile parameter
  const f1run = createDungeonRun(UNIT3_FLOOR1_ID, "phase3-f1");
  const f1visual = toGyeongseongVisualMap(prepareUnit3Floor1Map(f1run.map, f1run.seed));
  assert(JSON.stringify(planGyeongseongLayout(f1visual, f1run.seed)) === JSON.stringify(planGyeongseongLayout(f1visual, f1run.seed, "floor1")), "floor 1 street layout unchanged (default profile)");
  assert(getUnit3StoryFloor(UNIT3_FLOOR1_ID)?.streetProfile === "floor1" && getUnit3StoryFloor(UNIT3_FLOOR2_ID)?.streetProfile === "floor2-school" && Object.keys(UNIT3_STORY_FLOORS).length === 3, "story floor registry (Phase 4: + floor 3)");

  /* 4. quest flow: locked until floor 1 is completed, decline/accept, reward exactly once, 카프 stays */
  let state = createInitialGameSaveState();
  assert(getUnit3Floor2QuestPhase(state) === "locked" && acceptUnit3Floor2Quest(state) === state, "floor 2 locked before floor 1 is completed");
  state = floor1Completed();
  assert(getUnit3Floor2QuestPhase(state) === "notAccepted" && getUnit3TargetFloorId(state) === null, "floor 2 offered after floor 1");
  state = acceptUnit3Floor2Quest(state);
  assert(getUnit3Floor2QuestPhase(state) === "active" && state.floorUnlockState.unlockedFloorIds.includes(UNIT3_FLOOR2_ID) && getUnit3TargetFloorId(state) === UNIT3_FLOOR2_ID, "accepted: floor 2 open and targeted");
  assert(acceptUnit3Floor2Quest(state) === state, "accept idempotent");
  state = finishUnit3Floor2Run({ ...state, playerState: { ...state.playerState, currentHp: 7 } });
  assert(getUnit3Floor2QuestPhase(state) === "readyToComplete" && state.firstObjectiveEventSeen[UNIT3_FLOOR2_FLAGS.kafStaysAtSchool] && state.playerState.currentHp === state.playerState.maxHp && getUnit3TargetFloorId(state) === null, "final story: ready to report, 카프 stays at the school");
  const gold = state.playerState.gold, potions = getItemQuantity(state.inventoryState, "potion-small");
  const completed = completeUnit3Floor2Quest(state);
  assert(completed.playerState.gold === gold + 10 && getItemQuantity(completed.inventoryState, "potion-small") === potions + 2 && getItemQuantity(completed.inventoryState, UNIT3_FLOOR2_REWARD.weaponItemId) === 0 // hotfix: pen = achievement special reward
    && completed.achievementReceived[UNIT3_FLOOR2_ACHIEVEMENT.id] && completed.questState[UNIT3_FLOOR2_QUEST_ID] === "completed", "floor 2 rewards");
  assert(completeUnit3Floor2Quest(completed) === completed, "floor 2 rewards only once");
  // save round trip: flags, quest, pen, equipment, achievement
  const equipped = { ...completed, inventoryState: { ...completed.inventoryState, equippedItemIds: { ...completed.inventoryState.equippedItemIds, weaponSkin: UNIT3_FLOOR2_REWARD.weaponItemId } } };
  const validated = validateCurrentSave(JSON.parse(JSON.stringify(createSaveDataFromGameState(equipped))));
  assert(validated, "floor 2 save validates");
  const restored = applySaveDataToGameState(validated);
  assert(restored.questState[UNIT3_FLOOR2_QUEST_ID] === "completed" && restored.rewardClaimed[UNIT3_FLOOR2_QUEST_ID] && restored.inventoryState.equippedItemIds.weaponSkin === UNIT3_FLOOR2_REWARD.weaponItemId
    && restored.firstObjectiveEventSeen[UNIT3_FLOOR2_FLAGS.kafStaysAtSchool] && restored.achievementReceived[UNIT3_FLOOR2_ACHIEVEMENT.id], "floor 2 state survives save/load");

  /* 5. emergency supply: real combat rules, route-based need, no grant when affordable, pouch cap, no repeats */
  assert(Math.abs(expectedCombatDamage(2, 9, 29) - 25.59) < 1e-6 && Math.abs(expectedCombatDamage(3, 12, 29) - 47.184) < 1e-6, "expected damage at 70 % with the real turn rules");
  assert(EMERGENCY_SUPPLY_STORY.scenes[0].steps.map((step) => step.type === "narration" ? step.text : "").join("|") === "보급 물품 상자 속에서 한숨 소리가 들린 듯하다.|보급 물품 상자가 당신의 재산 상태를 안타까워 한다.|보급 물품 상자가 포션을 뱉어냈다! 아싸!", "supply narration");
  const f1Active: GameSaveState = (() => { const s = createInitialGameSaveState(); return { ...s, questState: { ...s.questState, [UNIT3_FLOOR1_QUEST_ID]: "active" } }; })();
  const withKit = (s: GameSaveState, small: number, medium: number, goldAmount: number, extra: Record<string, number> = {}): GameSaveState => ({
    ...s, playerState: { ...s.playerState, gold: goldAmount, currentHp: s.playerState.maxHp },
    inventoryState: { ...s.inventoryState, items: { ...s.inventoryState.items, "potion-small": small, "potion-medium": medium, ...extra } },
  });
  const broke = evaluateEmergencySupply(withKit(f1Active, 0, 0, 0));
  assert(broke.floorId === UNIT3_FLOOR1_ID && broke.grant > 0 && broke.grant <= 3 && broke.route && broke.route.normal >= 2, "no potions, no gold → support (floor 1)");
  assert(evaluateEmergencySupply(withKit(f1Active, 0, 0, 200)).grant === 0, "no potions but enough gold → no support");
  assert(evaluateEmergencySupply(withKit(f1Active, 3, 2, 0)).grant === 0, "enough potions, no gold → no support");
  const partial = evaluateEmergencySupply(withKit(f1Active, 1, 0, 8));
  assert(partial.grant >= 0 && partial.grant <= partial.freeSmallSlots && partial.buyableHealing === 20, "some potions + some gold: buyable counted, pouch room respected");
  assert(evaluateEmergencySupply(withKit(f1Active, 3, 0, 0)).grant === 0, "full small-potion pouch → nothing beyond the cap");
  const bigPouch = evaluateEmergencySupply(withKit(f1Active, 3, 0, 0, { "upgrade-small-potion-pouch": 2 }));
  assert(bigPouch.grant <= 2, "larger pouch: grant limited to the free room");
  assert(evaluateEmergencySupply(withKit(createInitialGameSaveState(), 0, 0, 0)).floorId === null && evaluateEmergencySupply(withKit(createInitialGameSaveState(), 0, 0, 0)).grant === 0, "no target floor → no support");
  const f1Cleared = withKit({ ...f1Active, firstObjectiveEventSeen: { [UNIT3_FLOOR1_FLAGS.finalStory]: true } }, 0, 0, 0);
  assert(evaluateEmergencySupply(f1Cleared).floorId === null, "floor already cleared (report pending) → no support");
  const f2Active = withKit(acceptUnit3Floor2Quest(floor1Completed()), 0, 0, 0);
  assert(evaluateEmergencySupply(f2Active).floorId === UNIT3_FLOOR2_ID && evaluateEmergencySupply(f2Active).grant > 0, "floor 2 is the target once accepted");
  const once = applyEmergencySupply(withKit(f1Active, 0, 0, 0));
  assert(once.granted === broke.grant && getItemQuantity(once.state.inventoryState, "potion-small") === broke.grant, "grant applied");
  const twice = applyEmergencySupply(once.state);
  assert(twice.granted === 0 && twice.state === once.state, "repeated click / unused potions → no second grant");
  assert(Object.keys(once.state.firstObjectiveEventSeen).some((key) => key.startsWith("unit3-emergency-supply:unit3-floor-1:grant-")), "grant recorded in the save");
  const spent = applyEmergencySupply({ ...once.state, inventoryState: { ...once.state.inventoryState, items: { ...once.state.inventoryState.items, "potion-small": 0 } } });
  assert(spent.granted > 0, "potions used up in a failed run → support again (no permanent lockout)");
  // deterministic route estimate (seeded): same answer every click
  assert(JSON.stringify(evaluateEmergencySupply(withKit(f1Active, 0, 0, 0))) === JSON.stringify(broke), "support decision is deterministic");
}
