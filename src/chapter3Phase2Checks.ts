import originalScript from "../docs/chapter3/floor1-original-script.txt?raw";
import { resolvePlayerNamePlaceholders, PLAYER_NAME_TOKEN_START, stripPlayerNameTokens } from "./game/story/StoryPlayer";
import { CHAPTER3_INTRO_SEQUENCE } from "./data/chapter3/chapter3IntroScript";
import { CHAPTER3_INTRO_PHASES } from "./data/chapter3/chapter3IntroStage";
import { CHAPTER3_STAGE_SPRITES } from "./data/chapter3/chapter3Actors";
import { createChapter3BaseCampHitboxes, createChapter3BaseCampNpcs } from "./data/chapter3/chapter3BaseCamp";
import { createDungeonRun } from "./game/dungeon/generation/floor1DungeonRuntime";
import { allocateDungeonRunQuestions } from "./game/dungeon/dungeonRunQuestionAllocator";
import { canEnterFinalRoom, isFinalRoom } from "./game/dungeon/dungeonExplorationResolver";
import {
  UNIT3_FLOOR1_ACHIEVEMENT, UNIT3_FLOOR1_FLAGS, UNIT3_FLOOR1_ID, UNIT3_FLOOR1_QUEST_ID, UNIT3_FLOOR1_REWARD, UNIT3_FLOOR1_STORY_FLAGS,
  UNIT3_FLOOR1_STORY_ROOM_IDS, UNIT3_MONSTER_IDS, acceptUnit3Floor1Quest, applyUnit3Floor1Progress, completeUnit3Floor1Quest,
  findCartRoomId, finishUnit3Floor1Run, getUnit3Floor1QuestPhase, markUnit3Flag, prepareUnit3Floor1Map,
} from "./game/chapter3/unit3Floor1";
import { UNIT3_FLOOR1_ALL_STORIES, UNIT3_FLOOR1_BASE_CAMP_RETURN_STORY, UNIT3_FLOOR1_FINAL_STORY } from "./data/chapter3/floor1Stories";
import { UNIT3_FLOOR1_STAGE_PHASES } from "./game/chapter3/Unit3Floor1Stage";
import { FORBIDDEN_ROAD_ASSET_FLOORS_1_TO_7, planGyeongseongLayout } from "./three/dungeon/gyeongseong/gyeongseongLayout";
import { applySaveDataToGameState, createInitialGameSaveState, createSaveDataFromGameState } from "./save/saveStateAdapter";
import { validateCurrentSave } from "./save/saveSchema";
import { getItemDefinition } from "./game/inventory/itemDefinitions";
import { getSwordDefinitionForEquippedItem } from "./three/weapon/SwordViewModel";
import { getMonsterVisualDefinition } from "./game/monster/monsterDefinitions";
import type { DungeonRoomProgress } from "./game/dungeon/dungeonTypes";
import type { StoryStep } from "./types/story";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[chapter3 phase2] ${message}`);
}

const PERMUTATIONS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

export function runChapter3Phase2Checks(): void {
  /* 1.2 player-name highlighting: structured tokens only */
  assert(!resolvePlayerNamePlaceholders("흩어지지 않도록", "지지").includes(PLAYER_NAME_TOKEN_START), "name inside a word is not tokenised");
  const tokenised = resolvePlayerNamePlaceholders("(플레이어 이름), 흩어지지 마!", "지지");
  assert(tokenised.split(PLAYER_NAME_TOKEN_START).length === 2 && stripPlayerNameTokens(tokenised) === "지지, 흩어지지 마!", "only the explicit placeholder is tokenised");
  assert(stripPlayerNameTokens(resolvePlayerNamePlaceholders("{{playerName}}!", "하늘")) === "하늘!", "{{playerName}} placeholder");

  /* 2. intro directions + new sprites (no player anywhere) */
  const steps = CHAPTER3_INTRO_SEQUENCE.scenes.flatMap((scene) => scene.steps);
  const kaidenShame = steps.filter((step): step is Extract<StoryStep, { type: "dialogue" }> => step.type === "dialogue" && step.speakerId === "kaiden" && step.expression === "shame").map((step) => step.text);
  assert(kaidenShame.includes("…그 이야기는 하지 않으셔도 됩니다.") && kaidenShame.some((text) => text.startsWith("아론, 자네까지")), "Kaiden shame lines");
  assert(CHAPTER3_INTRO_PHASES["hq-commanders"].actors.find((actor) => actor.id === "kaiden")?.facing === "L", "Kaiden first appears with standing_L");
  const researcherPhase = CHAPTER3_INTRO_PHASES["hq-researcher"].actors;
  assert(researcherPhase.find((actor) => actor.id === "kaiden")?.facing === "R" && researcherPhase.find((actor) => actor.id === "deneb")?.facing === "R", "Deneb/Kaiden turn to standing_R for the researcher");
  for (const id of ["kaiden", "luna", "theo"] as const) {
    const sprite = CHAPTER3_STAGE_SPRITES[id];
    assert(sprite.frameWidth === 600 && sprite.frameHeight === 700 && sprite.blink?.frames === 4 && sprite.images.L && sprite.images.R, `${id} uses the Phase 2 600x700 standing + 4-frame blink`);
  }
  assert(!("player" in CHAPTER3_STAGE_SPRITES), "player has no map sprite");
  assert(CHAPTER3_INTRO_SEQUENCE.skipTarget?.complete === true, "intro skip completes the intro");

  /* 3. base camp hitboxes */
  const npcs = createChapter3BaseCampNpcs();
  const hitboxes = createChapter3BaseCampHitboxes(npcs);
  assert(npcs.find((npc) => npc.id === "supply")?.displayName === "보급물품", "supply crates are called 보급물품");
  for (const [id, box] of Object.entries(hitboxes)) assert(box.width > 20 && box.height > 20, `${id} hitbox size`);
  const deneb = npcs.find((npc) => npc.id === "deneb")!.placement;
  assert(hitboxes.deneb.width < deneb.width && hitboxes.deneb.y > deneb.y, "Deneb hitbox fitted inside the transparent frame");

  /* 4. floor layout over many seeds */
  for (let n = 0; n < 40; n += 1) {
    const run = createDungeonRun(UNIT3_FLOOR1_ID, `phase2-check-${n}`);
    const map = prepareUnit3Floor1Map(run.map, run.seed);
    const cart = findCartRoomId(map);
    const adjacency = new Map<string, string[]>();
    map.connections.forEach((c) => {
      adjacency.set(c.fromRoomId, [...(adjacency.get(c.fromRoomId) ?? []), c.toRoomId]);
      adjacency.set(c.toRoomId, [...(adjacency.get(c.toRoomId) ?? []), c.fromRoomId]);
    });
    assert(adjacency.get(map.startRoomId)?.length === 1, `seed ${n}: start has one exit (cart room is unavoidable)`);
    const cartRoom = map.rooms.find((room) => room.id === cart)!;
    assert(cartRoom.type === "combat" && cartRoom.combatConfig?.monsterId === UNIT3_MONSTER_IDS.normalA, `seed ${n}: cart room fights 먹물 든 을사늑약 문서`);
    for (const storyId of UNIT3_FLOOR1_STORY_ROOM_IDS) {
      const room = map.rooms.find((candidate) => candidate.id === storyId);
      assert(room && room.type === "empty" && room.isRequired, `seed ${n}: ${storyId} is a required empty story room`);
      assert(adjacency.get(storyId)?.length === 1, `seed ${n}: ${storyId} is a dead end`);
      assert(!(adjacency.get(map.startRoomId) ?? []).includes(storyId), `seed ${n}: story room is not next to the start`);
      // reaching it from the start always passes the cart room
      const seen = new Set([map.startRoomId, cart]); const queue = [cart]; let reachedWithoutCart = false;
      const seenNoCart = new Set([map.startRoomId]); const q2 = [map.startRoomId];
      while (q2.length) { const c = q2.shift()!; for (const next of adjacency.get(c) ?? []) { if (next === cart || seenNoCart.has(next)) continue; seenNoCart.add(next); q2.push(next); if (next === storyId) reachedWithoutCart = true; } }
      assert(!reachedWithoutCart, `seed ${n}: ${storyId} unreachable without the cart room`);
      void seen; void queue;
    }
    const final = map.rooms.find((room) => room.isFinalQuestRoom)!;
    assert(final.type === "quest" && !final.combatConfig && !final.eliteConfig, `seed ${n}: final room has no combat`);
    assert(map.rooms.some((room) => room.type === "elite" && room.eliteConfig?.monsterId === UNIT3_MONSTER_IDS.elite), `seed ${n}: an elite 통감부 감시자 exists`);
    assert(map.rooms.filter((room) => room.type === "combat").every((room) => [UNIT3_MONSTER_IDS.normalA, UNIT3_MONSTER_IDS.normalB].includes(room.combatConfig!.monsterId as never)), `seed ${n}: normal monsters A/B only`);
    const questions = allocateDungeonRunQuestions(map, run.seed, UNIT3_FLOOR1_ID);
    assert(map.rooms.filter((room) => room.type === "combat" || room.type === "elite").every((room) => (questions[room.id]?.length ?? 0) > 0), `seed ${n}: every combat room has questions`);

    // final gate: only the cart room + the three story rooms are required, for all 6 visit orders
    const base = applyUnit3Floor1Progress(map, {}, {});
    assert(!canEnterFinalRoom(map, base), `seed ${n}: final gated at start`);
    for (const order of PERMUTATIONS) {
      let flags: Record<string, boolean> = { [UNIT3_FLOOR1_FLAGS.startEvent]: true, [UNIT3_FLOOR1_FLAGS.cartRescue]: true };
      let progress: Record<string, DungeonRoomProgress> = applyUnit3Floor1Progress(map, {}, flags);
      order.forEach((storyIndex, position) => {
        assert(!canEnterFinalRoom(map, progress), `seed ${n} order ${order}: gated before story ${position + 1}`);
        flags = { ...flags, [UNIT3_FLOOR1_STORY_FLAGS[storyIndex]]: true };
        progress = applyUnit3Floor1Progress(map, progress, flags);
      });
      assert(canEnterFinalRoom(map, progress) && isFinalRoom(map, final.id), `seed ${n} order ${order}: final open after all three`);
    }

    // 3D layout: deterministic, no buildings on streets, no overlaps, no gaps, never the cracked road
    const layout = planGyeongseongLayout(map, run.seed);
    const again = planGyeongseongLayout(map, run.seed);
    assert(JSON.stringify(layout.buildings) === JSON.stringify(again.buildings) && layout.tiles.length === again.tiles.length, `seed ${n}: layout deterministic`);
    const covered = new Set<string>();
    for (const building of layout.buildings) {
      for (const cell of building.cells) {
        assert(!layout.open.has(cell), `seed ${n}: building ${building.model} on an open cell ${cell}`);
        assert(!covered.has(cell), `seed ${n}: overlapping buildings at ${cell}`);
        covered.add(cell);
      }
    }
    const blockCells = new Set(layout.blocks.map((block) => `${block.x / 2},${block.z / 2}`));
    for (let j = layout.bounds.minJ; j <= layout.bounds.maxJ; j += 1) {
      for (let i = layout.bounds.minI; i <= layout.bounds.maxI; i += 1) {
        const k = `${i},${j}`;
        if (layout.open.has(k)) continue;
        assert(covered.has(k) || blockCells.has(k), `seed ${n}: gap at closed cell ${k}`);
      }
    }
    assert(layout.tiles.every((tile) => ["road-paving", "road-tram", "road-curb"].includes(tile.tile)), `seed ${n}: only permitted road tiles`);
    assert(!JSON.stringify(layout).includes(FORBIDDEN_ROAD_ASSET_FLOORS_1_TO_7) && !JSON.stringify(layout).includes("cracked"), `seed ${n}: 12a-cracked-road never used`);
    // every room centre and every camera stop is an open cell (camera never inside a building)
    for (const room of map.rooms) assert(layout.open.has(`${Math.round(room.position.x / 2)},${Math.round(room.position.z / 2)}`), `seed ${n}: room centre open`);
    for (const connection of map.connections) {
      for (const point of connection.cameraPath) {
        assert(layout.open.has(`${Math.round(point.position[0] / 2)},${Math.round(point.position[2] / 2)}`), `seed ${n}: camera path stays on the street`);
      }
    }
  }

  /* 5. dialogue fidelity: every line comes from the original script (overrides excepted) */
  const normalize = (text: string) => text.replace(/\s+/g, "").replace(/[“”"]/g, "");
  const source = normalize(originalScript);
  for (const story of UNIT3_FLOOR1_ALL_STORIES) {
    if (story === UNIT3_FLOOR1_BASE_CAMP_RETURN_STORY) continue; // Event I is replaced by a narration (Phase 2 override)
    for (const step of story.scenes.flatMap((scene) => scene.steps)) {
      if (step.type === "dialogue" || step.type === "narration") assert(source.includes(normalize(step.text)), `${story.id}: line not in the original script: ${step.text}`);
      if (step.type === "choice") step.options.forEach((option) => assert(source.includes(normalize(option.label)), `${story.id}: choice not in the script: ${option.label}`));
      if (step.type === "setStagePhase") assert(step.phase in UNIT3_FLOOR1_STAGE_PHASES, `${story.id}: unknown stage phase ${step.phase}`);
    }
  }
  const finalSpeakers = UNIT3_FLOOR1_FINAL_STORY.scenes.flatMap((scene) => scene.steps).flatMap((step) => step.type === "dialogue" ? [step.speakerName] : []);
  const firstMinsu = finalSpeakers.indexOf("민수");
  assert(firstMinsu > 0 && !finalSpeakers.slice(firstMinsu).includes("짐꾼") && finalSpeakers.slice(0, firstMinsu).includes("짐꾼"), "speaker name changes 짐꾼 → 민수 at the reveal");
  const allText = JSON.stringify(UNIT3_FLOOR1_ALL_STORIES);
  assert(!/standing/i.test(allText.replace(/standing_[LR]/g, "")), "no standing PNG for the porter/민수");

  /* 6. quest flow, rewards once, save compatibility */
  let state = createInitialGameSaveState();
  assert(getUnit3Floor1QuestPhase(state) === "notAccepted", "quest starts not accepted");
  state = acceptUnit3Floor1Quest(state);
  assert(state.questState[UNIT3_FLOOR1_QUEST_ID] === "active" && state.floorUnlockState.unlockedFloorIds.includes(UNIT3_FLOOR1_ID), "accept unlocks Floor 1");
  for (const flag of [UNIT3_FLOOR1_FLAGS.startEvent, UNIT3_FLOOR1_FLAGS.cartRescue, ...UNIT3_FLOOR1_STORY_FLAGS, UNIT3_FLOOR1_FLAGS.postEventTalk]) state = markUnit3Flag(state, flag);
  state = finishUnit3Floor1Run(state);
  assert(getUnit3Floor1QuestPhase(state) === "readyToComplete" && state.clearedFloorIds.includes(UNIT3_FLOOR1_ID), "final story → ready to complete");
  const gold = state.playerState.gold;
  const potions = state.inventoryState.items["potion-small"] ?? 0;
  const roundTrip = applySaveDataToGameState(createSaveDataFromGameState(state));
  const completed = completeUnit3Floor1Quest(roundTrip);
  const twice = completeUnit3Floor1Quest(completeUnit3Floor1Quest(completed));
  assert(completed.playerState.gold === gold + UNIT3_FLOOR1_REWARD.gold && twice.playerState.gold === completed.playerState.gold, "10 gold exactly once");
  assert(completed.inventoryState.items["potion-small"] === potions + 2 && twice.inventoryState.items["potion-small"] === completed.inventoryState.items["potion-small"], "2 small potions exactly once");
  assert(completed.inventoryState.items[UNIT3_FLOOR1_REWARD.weaponItemId] === 1 && twice.inventoryState.items[UNIT3_FLOOR1_REWARD.weaponItemId] === 1, "Hwando unlocked once");
  assert(completed.achievementReceived[UNIT3_FLOOR1_ACHIEVEMENT.id] && completed.questState[UNIT3_FLOOR1_QUEST_ID] === "completed", "achievement + quest completed");
  // the Unit 3 quest status must survive the schema validation used when loading from storage
  const validatedReady = validateCurrentSave(JSON.parse(JSON.stringify(createSaveDataFromGameState(state))));
  assert(validatedReady && validatedReady.quests.statuses[UNIT3_FLOOR1_QUEST_ID] === "active", "Unit 3 quest status survives save validation");
  const reloaded = applySaveDataToGameState(validateCurrentSave(JSON.parse(JSON.stringify(createSaveDataFromGameState(twice))))!);
  assert(getUnit3Floor1QuestPhase(reloaded) === "completed" && reloaded.firstObjectiveEventSeen[UNIT3_FLOOR1_FLAGS.hwandoUnlocked], "completion survives save/load");
  // Phase 1 / Unit 2 style save without any Unit 3 flags still loads
  const legacy = createSaveDataFromGameState(createInitialGameSaveState());
  const loaded = applySaveDataToGameState({ ...legacy, questProgress: { ...legacy.questProgress, firstObjectiveEventSeen: { "floor-1": true } } });
  assert(getUnit3Floor1QuestPhase(loaded) === "notAccepted", "legacy save loads with the Floor 1 quest not accepted");

  /* 7. Hwando + monsters */
  const hwando = getItemDefinition(UNIT3_FLOOR1_REWARD.weaponItemId)!;
  assert(hwando.type === "weaponSkin" && hwando.name === "의병의 환도" && !hwando.attackVfxId && !("maxHpBonus" in hwando), "Hwando: cosmetic weapon skin with the default physical hit VFX");
  assert(getSwordDefinitionForEquippedItem(hwando.id).textureUrl.endsWith("assets/swords/uibyeong-hwando.png"), "Hwando uses the supplied texture on the existing sword model");
  assert(getMonsterVisualDefinition(UNIT3_MONSTER_IDS.normalA).name === "먹물 든 을사늑약 문서" && getMonsterVisualDefinition(UNIT3_MONSTER_IDS.normalB).name === "밀고의 그림자" && getMonsterVisualDefinition(UNIT3_MONSTER_IDS.elite).name === "통감부 감시자", "monster names");
  console.info("chapter3 phase 2 (names, intro, camp, floor 1 layout/gates/6 orders, script, rewards, saves, 3D layout): PASS");
}
