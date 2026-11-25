import revisedScript from "../docs/chapter3/floor1-script-hotfix3.txt?raw";
import { resolvePlayerNamePlaceholders, PLAYER_NAME_TOKEN_START, stripPlayerNameTokens } from "./game/story/StoryPlayer";
import { CHAPTER3_INTRO_ARRIVAL_SEQUENCE, CHAPTER3_INTRO_HQ_SEQUENCE, CHAPTER3_INTRO_SEQUENCE } from "./data/chapter3/chapter3IntroScript";
import { CHAPTER3_INTRO_PHASES } from "./data/chapter3/chapter3IntroStage";
import { CHAPTER3_STAGE_SPRITES } from "./data/chapter3/chapter3Actors";
import { createChapter3BaseCampHitboxes, createChapter3BaseCampNpcs } from "./data/chapter3/chapter3BaseCamp";
import { createDungeonRun } from "./game/dungeon/generation/floor1DungeonRuntime";
import { allocateDungeonRunQuestions } from "./game/dungeon/dungeonRunQuestionAllocator";
import { canEnterFinalRoom, isFinalRoom } from "./game/dungeon/dungeonExplorationResolver";
import {
  UNIT3_FLOOR1_ACHIEVEMENT, UNIT3_FLOOR1_FLAGS, UNIT3_FLOOR1_ID, UNIT3_FLOOR1_QUEST_ID, UNIT3_FLOOR1_QUEST_TITLE, UNIT3_FLOOR1_REWARD, UNIT3_FLOOR1_STORY_FLAGS, UNIT3_FLOOR1_TITLE,
  UNIT3_FLOOR1_STORY_ROOM_IDS, UNIT3_MONSTER_IDS, acceptUnit3Floor1Quest, applyUnit3Floor1Progress, completeUnit3Floor1Quest,
  findCartRoomId, finishUnit3Floor1Run, getUnit3Floor1QuestPhase, markUnit3Flag, prepareUnit3Floor1Map,
} from "./game/chapter3/unit3Floor1";
import { UNIT3_FLOOR1_ALL_STORIES, UNIT3_FLOOR1_FINAL_STORY, UNIT3_FLOOR1_ILLUST } from "./data/chapter3/floor1Stories";
import { DUNGEON_FLOOR_TITLES } from "./data/DungeonFloorTitles";
import { UNIT3_FLOOR1_STAGE_PHASES } from "./game/chapter3/Unit3Floor1Stage";
import { BUILDING_MODEL_IDS, CELL, FORBIDDEN_ROAD_ASSET_FLOORS_1_TO_7, GYEONGSEONG_WORLD_SCALE, PLAZA_HALF_CELLS, STREET_HALF_CELLS, cellOf, planGyeongseongLayout, toGyeongseongVisualMap } from "./three/dungeon/gyeongseong/gyeongseongLayout";
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
  // hotfix: two intro states, one skip per state, guarded against double clicks
  assert(CHAPTER3_INTRO_HQ_SEQUENCE.scenes.length === 1 && CHAPTER3_INTRO_HQ_SEQUENCE.scenes[0].id === "chapter3-hq", "HQ_INTRO is its own sequence");
  const arrivalSteps = CHAPTER3_INTRO_ARRIVAL_SEQUENCE.scenes[0].steps;
  assert(CHAPTER3_INTRO_ARRIVAL_SEQUENCE.scenes[0].id === "chapter3-arrival" && arrivalSteps[0].type === "fade" && arrivalSteps.some((step) => step.id === "arrival-start"), "ARRIVAL_INTRO starts from the first arrival step");
  assert((CHAPTER3_INTRO_HQ_SEQUENCE.skipDelayMs ?? 0) >= 500 && (CHAPTER3_INTRO_ARRIVAL_SEQUENCE.skipDelayMs ?? 0) >= 500, "skip guarded against double clicks");

  /* 3. base camp hitboxes */
  const npcs = createChapter3BaseCampNpcs();
  const hitboxes = createChapter3BaseCampHitboxes(npcs);
  const supply = npcs.find((npc) => npc.id === "supply")!;
  assert(supply.displayName === "보급물품" && supply.displayRole === "상점" && supply.nameTagVariant === "shop", "supply name tag: 상점 / 보급물품");
  assert(Math.abs(supply.placement.width - 2 * 132) <= 2 && Math.abs(supply.placement.width / supply.placement.height - 1568 / 1003) < 0.02, "supply crates 2× (ratio kept)");
  const kaidenBox = createChapter3BaseCampHitboxes(npcs).kaiden;
  assert(createChapter3BaseCampHitboxes(npcs).supply.x > kaidenBox.x + kaidenBox.width, "supply crates clear of Kaiden");
  for (const [id, box] of Object.entries(hitboxes)) assert(box.width > 20 && box.height > 20, `${id} hitbox size`);
  const deneb = npcs.find((npc) => npc.id === "deneb")!.placement;
  assert(hitboxes.deneb.width < deneb.width && hitboxes.deneb.y > deneb.y, "Deneb hitbox fitted inside the transparent frame");

  /* 4. floor layout over many seeds */
  const coverage: number[] = [];
  const heights: number[] = [];
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
    assert(map.rooms.some((room) => room.type === "elite" && room.eliteConfig?.monsterId === UNIT3_MONSTER_IDS.elite), `seed ${n}: an elite 봉쇄의 파수꾼 exists`);
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
      // Phase 3 hotfix: the cart fight is not resolved by its permanent flag — it is fought again in every run.
      assert(progress[cart]?.eventCompleted !== true && !canEnterFinalRoom(map, progress), `seed ${n} order ${order}: cart room not resolved by the flag (fought again this run)`);
      progress = { ...progress, [cart]: { roomId: cart, eventCompleted: true } };
      assert(canEnterFinalRoom(map, progress) && isFinalRoom(map, final.id), `seed ${n} order ${order}: final open after all three + this run's cart fight`);
    }

    // 3D: logical map → visual map only moves positions
    const visual = toGyeongseongVisualMap(map);
    assert(JSON.stringify(visual.rooms.map((room) => [room.id, room.type, room.isRequired, room.isFinalQuestRoom, room.combatConfig?.monsterId, room.eliteConfig?.monsterId])) === JSON.stringify(map.rooms.map((room) => [room.id, room.type, room.isRequired, room.isFinalQuestRoom, room.combatConfig?.monsterId, room.eliteConfig?.monsterId])), `seed ${n}: visual map keeps the logical rooms`);
    assert(JSON.stringify(visual.connections.map((c) => [c.fromRoomId, c.toRoomId, c.directionFromSource])) === JSON.stringify(map.connections.map((c) => [c.fromRoomId, c.toRoomId, c.directionFromSource])) && visual.startRoomId === map.startRoomId, `seed ${n}: visual map keeps the connections`);
    for (const room of visual.rooms) {
      const logical = map.rooms.find((candidate) => candidate.id === room.id)!;
      assert(room.position.x === logical.position.x * GYEONGSEONG_WORLD_SCALE && room.position.z === logical.position.z * GYEONGSEONG_WORLD_SCALE, `seed ${n}: room spread`);
      const offset = (pose: { position: number[]; lookAt: number[] }) => Math.hypot(pose.lookAt[0] - pose.position[0], pose.lookAt[2] - pose.position[2]);
      assert(Math.abs(offset(room.explorationCameraPose) - offset(logical.explorationCameraPose)) < 1e-9, `seed ${n}: camera → monster distance unchanged`);
    }
    assert(canEnterFinalRoom(visual, applyUnit3Floor1Progress(visual, {}, {})) === false && findCartRoomId(visual) === cart, `seed ${n}: gates identical on the visual map`);

    // 3D layout: deterministic, only supplied FBX buildings, no overlaps / street intrusion, never 12a
    const layout = planGyeongseongLayout(visual, run.seed);
    const again = planGyeongseongLayout(visual, run.seed);
    assert(JSON.stringify(layout.buildings) === JSON.stringify(again.buildings) && layout.tiles.length === again.tiles.length, `seed ${n}: layout deterministic`);
    assert(layout.buildings.length > 20 && layout.buildings.every((building) => BUILDING_MODEL_IDS.includes(building.model)), `seed ${n}: buildings are the supplied FBX models only`);
    assert(!("blocks" in layout), `seed ${n}: no generated block buildings`);
    const covered = new Set<string>();
    for (const building of layout.buildings) {
      for (const cell of building.cells) {
        assert(!layout.open.has(cell), `seed ${n}: building ${building.model} on the street/plaza at ${cell}`);
        assert(!covered.has(cell), `seed ${n}: overlapping buildings at ${cell}`);
        covered.add(cell);
      }
    }
    for (let a = 0; a < layout.buildings.length; a += 1) for (let b = a + 1; b < layout.buildings.length; b += 1) {
      const p = layout.buildings[a], q = layout.buildings[b];
      const overlap = Math.min(p.maxX, q.maxX) - Math.max(p.minX, q.minX) > 0.01 && Math.min(p.maxZ, q.maxZ) - Math.max(p.minZ, q.minZ) > 0.01;
      assert(!overlap, `seed ${n}: footprints of ${p.model} and ${q.model} intersect`);
    }
    // façade coverage: most closed cells that touch the streets are fronted by a building
    let frontCells = 0, frontCovered = 0;
    for (let j = layout.bounds.minJ; j <= layout.bounds.maxJ; j += 1) for (let i = layout.bounds.minI; i <= layout.bounds.maxI; i += 1) {
      if (layout.open.has(`${i},${j}`)) continue;
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => layout.open.has(`${i + a},${j + b}`))) continue;
      frontCells += 1;
      // covered either directly or by a building set back right behind it
      if ([0, 1].some((d) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => layout.open.has(`${i + a},${j + b}`) && covered.has(`${i - a * d},${j - b * d}`)))) frontCovered += 1;
    }
    coverage.push(frontCovered / frontCells);
    heights.push(...layout.buildings.map((building) => building.height));
    const tileCells = new Set(layout.tiles.map((tile) => `${cellOf(tile.x)},${cellOf(tile.z)}`));
    assert([...layout.open.keys()].every((cell) => tileCells.has(cell)) && tileCells.size === layout.tiles.length, `seed ${n}: one road tile per open cell (no holes)`);
    assert(layout.tiles.every((tile) => !covered.has(`${cellOf(tile.x)},${cellOf(tile.z)}`)), `seed ${n}: no pavement tile under a building`);
    assert(layout.tiles.every((tile) => ["road-paving", "road-tram", "road-curb"].includes(tile.tile)), `seed ${n}: only permitted road tiles`);
    assert(!JSON.stringify(layout).includes(FORBIDDEN_ROAD_ASSET_FLOORS_1_TO_7) && !JSON.stringify(layout).includes("cracked"), `seed ${n}: 12a-cracked-road never used`);
    // every room centre and every camera stop is on the street (camera never inside a building)
    const cellKey = (x: number, z: number) => `${cellOf(x)},${cellOf(z)}`;
    for (const room of visual.rooms) {
      for (const [dx, dz] of [[-0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [0.5, -0.5]]) assert(layout.open.has(cellKey(room.position.x + dx, room.position.z + dz)), `seed ${n}: room centre open`);
      const look = room.explorationCameraPose.lookAt;
      assert(layout.open.has(cellKey(look[0], look[2])), `seed ${n}: monster spot open`);
    }
    for (const connection of visual.connections) {
      for (const point of connection.cameraPath) assert(layout.open.has(cellKey(point.position[0] + 0.01, point.position[2] + 0.01)), `seed ${n}: camera path stays on the street`);
    }
  }
  const averageCoverage = coverage.reduce((a, b) => a + b, 0) / coverage.length;
  const averageHeight = heights.reduce((a, b) => a + b, 0) / heights.length;
  assert(averageCoverage > 0.85, `façades cover the streets (${averageCoverage.toFixed(2)})`);
  // Phase 2 FBX buildings averaged 6.6 units high / 5.8 wide over these seeds; target ≈ 2.5×
  assert(averageHeight / 6.57 > 2.3 && averageHeight / 6.57 < 3, `building size ≈ 2.5× Phase 2 (average height ${averageHeight.toFixed(1)})`);
  assert(STREET_HALF_CELLS * 2 * CELL === 18 && PLAZA_HALF_CELLS * 2 * CELL === 24, "streets 18 wide (Phase 2: 6), plazas 24 (Phase 2: 10)");
  console.info(`  gyeongseong: façade coverage ${(averageCoverage * 100).toFixed(1)} %, average building height ${averageHeight.toFixed(1)}`);

  /* 5. dialogue fidelity (Hotfix 3): the implemented stories reproduce the revised script line by line —
        same order, speaker, expression, text and choices; nothing missing, nothing left from the old script. */
  type ScriptLine = { kind: "line"; speaker: string; expression: string; text: string } | { kind: "choice"; text: string };
  const SPEAKERS = ["데네브", "카이든", "주민", "다른 주민", "짐꾼", "민수", "의병 연락원", "해산 군인"];
  const scriptLines: ScriptLine[] = [];
  let speaker: string | null = null, expression = "default";
  for (const raw of revisedScript.slice(0, revisedScript.indexOf("[퀘스트 보상]")).split("\n")) {
    const line = raw.trim();
    const header = /^(.+?)\s*(?:\((\w+)\))?$/.exec(line);
    const quoted = /^"(.*)"$/.exec(line);
    const choice = /^[①②]\s*"(.*)"$/.exec(line);
    if (choice) { scriptLines.push({ kind: "choice", text: choice[1].trim() }); speaker = null; continue; }
    if (quoted) {
      assert(speaker !== null, `script line without a speaker: ${line}`);
      scriptLines.push({ kind: "line", speaker, expression, text: quoted[1].trim() });
      continue;
    }
    if (line === "dialogue") { speaker = "narration"; expression = "-"; continue; }
    if (header && SPEAKERS.includes(header[1])) { speaker = header[1]; expression = header[2] ?? "default"; continue; }
    if (line) speaker = null;
  }
  const storyLines: ScriptLine[] = UNIT3_FLOOR1_ALL_STORIES.flatMap((story) => story.scenes.flatMap((scene) => scene.steps)).flatMap((step): ScriptLine[] => {
    if (step.type === "dialogue") return [{ kind: "line", speaker: step.speakerName ?? "", expression: step.expression ?? "default", text: step.text }];
    if (step.type === "narration") return [{ kind: "line", speaker: "narration", expression: "-", text: step.text }];
    if (step.type === "choice") return step.options.map((option) => ({ kind: "choice" as const, text: option.label }));
    return [];
  });
  // The one speaker-label difference the script itself asks for: from the reveal on, 짐꾼 is shown as 민수.
  assert(scriptLines.length === storyLines.length, `script has ${scriptLines.length} lines/choices, stories have ${storyLines.length}`);
  scriptLines.forEach((expected, index) => {
    const actual = storyLines[index];
    assert(JSON.stringify(actual) === JSON.stringify(expected), `line ${index + 1}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  });
  for (const story of UNIT3_FLOOR1_ALL_STORIES) {
    for (const step of story.scenes.flatMap((scene) => scene.steps)) {
      if (step.type === "setStagePhase") assert(step.phase in UNIT3_FLOOR1_STAGE_PHASES, `${story.id}: unknown stage phase ${step.phase}`);
    }
  }
  console.info(`  floor 1 script: ${scriptLines.length} lines/choices match the revised script (order, speaker, expression, text)`);
  // titles / names / portraits
  assert(UNIT3_FLOOR1_TITLE === "을사늑약과 항일 의병 운동" && UNIT3_FLOOR1_QUEST_TITLE === "돌아갈 곳을 잊은 사람", "floor title / quest title");
  assert(DUNGEON_FLOOR_TITLES.find((entry) => entry.floorId === UNIT3_FLOOR1_ID)?.subtitle === UNIT3_FLOOR1_TITLE, "floor intro subtitle uses the new title");
  const actors = UNIT3_FLOOR1_FINAL_STORY.actors;
  assert(actors.resident2.name === "다른 주민" && actors.resident2.portraits.default.imageUrl?.endsWith("assets/chapter3/floor1/portraits/street-resident-2.png"), "다른 주민 uses its own portrait");
  assert(actors.resident.portraits.default.imageUrl?.endsWith("portraits/street-resident.png") && actors.porter.portraits.default.imageUrl?.endsWith("portraits/porter.png")
    && actors.minsu.portraits.default.imageUrl?.endsWith("portraits/porter.png") && actors.liaison.portraits.default.imageUrl?.endsWith("portraits/militia-liaison.png")
    && actors.soldier.portraits.default.imageUrl?.endsWith("portraits/korean-empire-soldier.png"), "other Floor 1 portraits unchanged");
  const resident2Stories = UNIT3_FLOOR1_ALL_STORIES.filter((story) => story.scenes.some((scene) => scene.steps.some((step) => step.type === "dialogue" && step.speakerId === "resident2"))).map((story) => story.id);
  assert(resident2Stories.join() === "unit3-floor1-start,unit3-floor1-story-1", `다른 주민 speaks in the start room and story room 1 only (${resident2Stories.join()})`);
  // final room choice: two options, both continue to the same scene (story choice, no effect)
  const finalChoice = UNIT3_FLOOR1_FINAL_STORY.scenes[0].steps.find((step) => step.type === "choice");
  assert(finalChoice?.type === "choice" && finalChoice.options.length === 2 && finalChoice.options.every((option) => option.nextStepId === "u3f1-final-merge"), "final choice: both options merge");
  assert(Object.keys(UNIT3_FLOOR1_ILLUST).length === 8, "illustrations reused (no new illustration assets)");
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
  // Phase 3 hotfix: the hwando is the special reward (achievement window), not part of the quest completion.
  assert(!completed.inventoryState.items[UNIT3_FLOOR1_REWARD.weaponItemId] && !twice.inventoryState.items[UNIT3_FLOOR1_REWARD.weaponItemId], "quest completion no longer grants the hwando");
  assert(completed.achievementReceived[UNIT3_FLOOR1_ACHIEVEMENT.id] && completed.questState[UNIT3_FLOOR1_QUEST_ID] === "completed", "achievement + quest completed");
  // the Unit 3 quest status must survive the schema validation used when loading from storage
  const validatedReady = validateCurrentSave(JSON.parse(JSON.stringify(createSaveDataFromGameState(state))));
  assert(validatedReady && validatedReady.quests.statuses[UNIT3_FLOOR1_QUEST_ID] === "active", "Unit 3 quest status survives save validation");
  const reloaded = applySaveDataToGameState(validateCurrentSave(JSON.parse(JSON.stringify(createSaveDataFromGameState(twice))))!);
  assert(getUnit3Floor1QuestPhase(reloaded) === "completed" && reloaded.firstObjectiveEventSeen[UNIT3_FLOOR1_FLAGS.questCompleted] && !reloaded.firstObjectiveEventSeen[UNIT3_FLOOR1_FLAGS.hwandoUnlocked], "completion survives save/load (no legacy grant flag written)");
  // Phase 1 / Unit 2 style save without any Unit 3 flags still loads
  const legacy = createSaveDataFromGameState(createInitialGameSaveState());
  const loaded = applySaveDataToGameState({ ...legacy, questProgress: { ...legacy.questProgress, firstObjectiveEventSeen: { "floor-1": true } } });
  assert(getUnit3Floor1QuestPhase(loaded) === "notAccepted", "legacy save loads with the Floor 1 quest not accepted");

  /* 7. Hwando + monsters */
  const hwando = getItemDefinition(UNIT3_FLOOR1_REWARD.weaponItemId)!;
  assert(hwando.type === "weaponSkin" && hwando.name === "의병의 환도" && !("maxHpBonus" in hwando), "Hwando: cosmetic weapon skin (no stats)");
  assert(hwando.description === "나라를 지키려고 모인 의병들이 사용하던 칼을 본뜬 무기.", "Hwando description");
  assert(UNIT3_FLOOR1_ACHIEVEMENT.id === "achievement-unit3-first-returnee" && UNIT3_FLOOR1_ACHIEVEMENT.title === "첫 번째 귀환자"
    && UNIT3_FLOOR1_ACHIEVEMENT.description === "던전에서 자신의 이름과 가족을 잊어 가던 주민을 구출했다.", "achievement id/title kept, description replaced");
  assert(getSwordDefinitionForEquippedItem(hwando.id).textureUrl.endsWith("assets/swords/uibyeong-hwando.png"), "Hwando uses the supplied texture on the existing sword model");
  assert(getMonsterVisualDefinition(UNIT3_MONSTER_IDS.normalA).name === "먹물 든 을사늑약 문서" && getMonsterVisualDefinition(UNIT3_MONSTER_IDS.normalB).name === "길을 막는 그림자" && getMonsterVisualDefinition(UNIT3_MONSTER_IDS.elite).name === "봉쇄의 파수꾼", "monster names");
  assert(UNIT3_MONSTER_IDS.normalB === "unit3-informant-shadow" && UNIT3_MONSTER_IDS.elite === "unit3-residency-general-watcher", "monster ids unchanged");
  console.info("chapter3 phase 2 (names, intro, camp, floor 1 layout/gates/6 orders, script, rewards, saves, 3D layout): PASS");
}
