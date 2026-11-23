import { CHAPTER3_INTRO_SEQUENCE, CHAPTER3_STAGE_ID } from "./data/chapter3/chapter3IntroScript";
import { CHAPTER3_INTRO_PHASES, STAGE_FOOT_Y } from "./data/chapter3/chapter3IntroStage";
import { CHAPTER3_STAGE_SPRITES, CHAPTER3_STORY_ACTORS, STAGE_SPRITE_SCALE } from "./data/chapter3/chapter3Actors";
import { RECAP_IMAGES, CHAPTER3_MAP_SIZE } from "./data/chapter3/chapter3Assets";
import { CHAPTER3_BASE_CAMP_MAP, createChapter3BaseCampNpcs } from "./data/chapter3/chapter3BaseCamp";
import { completeChapter3Intro, isChapter3IntroCompleted, resolveContinueScreen } from "./app/chapter3Flow";
import { createInitialGameSaveState, createSaveDataFromGameState, applySaveDataToGameState } from "./save/saveStateAdapter";
import { SAVE_STORAGE_KEYS, UNIT2_SAVE_STORAGE_KEYS } from "./save/saveConstants";
import { rollTramDelayMs, tramLeftAt } from "./game/baseCamp/BaseCampTram";
import { clampCameraCenter } from "./game/chapter3/MapStage";
import type { StoryStep } from "./types/story";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[chapter3] ${message}`);
}

const steps: StoryStep[] = CHAPTER3_INTRO_SEQUENCE.scenes.flatMap((scene) => scene.steps);
const byId = new Map(steps.map((step, index) => [step.id, index]));

/** Follow the script like StoryPlayer does, picking choice options by label. */
function walk(picks: string[]) {
  const queue = [...picks];
  const lines: string[] = [];
  const phases: string[] = [];
  let index = 0;
  for (let guard = 0; guard < 5000 && index < steps.length; guard += 1) {
    const step = steps[index];
    if (step.type === "choice") {
      const label = queue.shift();
      const option = step.options.find((candidate) => candidate.label === label);
      assert(option, `no option ${label} in ${step.id}`);
      index = byId.get(option.nextStepId!)!;
      continue;
    }
    if (step.type === "dialogue" || step.type === "narration") lines.push(step.type === "dialogue" ? `${step.speakerName}:${step.text}` : step.text);
    if (step.type === "setStagePhase") phases.push(step.phase);
    const next = step.type === "dialogue" && step.nextStepId ? byId.get(step.nextStepId) : index + 1;
    assert(next !== undefined, `bad nextStepId in ${step.id}`);
    index = next;
  }
  assert(index >= steps.length, "script did not reach the end");
  return { lines, phases };
}

export function runChapter3Checks() {
  // ids unique, every jump target exists, every stage phase exists, every expression resolves
  assert(byId.size === steps.length, "duplicate step ids");
  for (const step of steps) {
    if (step.type === "dialogue") {
      if (step.nextStepId) assert(byId.has(step.nextStepId), `missing target ${step.nextStepId}`);
      const actor = CHAPTER3_STORY_ACTORS[step.activeActorId!];
      assert(actor, `unknown actor ${step.activeActorId}`);
      assert(actor.portraits[step.expression ?? "default"], `missing portrait ${actor.id}/${step.expression}`);
    }
    if (step.type === "choice") step.options.forEach((option) => assert(byId.has(option.nextStepId!), `missing choice target ${option.nextStepId}`));
    if (step.type === "setStagePhase") {
      assert(step.stageId === CHAPTER3_STAGE_ID, "stage id");
      assert(CHAPTER3_INTRO_PHASES[step.phase], `unknown phase ${step.phase}`);
    }
  }

  // three HQ paths and two arrival answers all merge and reach the base camp transition
  const paths = [
    walk(["물론이지.", "괜찮습니다."]),
    walk(["잘 기억나지 않아.", "아니오", "조금 어지럽습니다."]),
    walk(["잘 기억나지 않아.", "예", "괜찮습니다."]),
  ];
  for (const path of paths) {
    assert(path.lines.includes("아론:지난 원정에서는 모두 고생이 많았습니다."), "HQ branches merge at Aron");
    assert(path.lines.at(-1) === "데네브:어떤 위협이 있을 지 모르니 , 서두르지 말고 함께 움직여요.", "ends with Deneb's last line (verbatim)");
    assert(path.phases.at(-1) === "arrival-drop", "ends with the layer drop");
    assert(path.lines.includes("카이든:예. 저희는 괜찮습니다. 데네브님은?"), "arrival answers merge");
  }
  assert(paths[0].lines.includes("루나:역시! 그렇게 많은 일이 있었는데 잊을 수가 없지!"), "branch ① line");
  assert(paths[1].lines.includes("루나:좋아! 필요한 건 우리가 옆에서 알려줄게."), "branch ②-아니오 line");
  const recap = paths[2].lines.filter((line) => !line.includes(":"));
  assert(recap.length === 10, `recap narration count ${recap.length}`); // 8 summary lines (3 + 5, 7 images) + 2 black-screen narrations
  assert(recap[1].includes("<blue><b>전</b></blue>"), "only 전 is blue bold");
  assert(paths[2].lines.includes("루나:이제 좀 생각나? 이번에도 잘 부탁해!"), "branch ②-예 line");

  // 7 recap images (3 + 4), the last one reused dimmed
  const recapSteps = steps.filter((step): step is Extract<StoryStep, { type: "illustOverlay" }> => step.type === "illustOverlay" && Boolean(step.imageUrl) && Object.values(RECAP_IMAGES).includes(step.imageUrl!));
  assert(new Set(recapSteps.map((step) => step.imageUrl)).size === 7, "7 distinct recap images");
  assert(recapSteps.at(-1)?.dimmed === true && recapSteps.at(-1)?.imageUrl === RECAP_IMAGES.unit2Devourer, "last recap shot is the dimmed devourer");

  // first person: the player is never a visible actor on any map, in any phase
  const visibleIds = new Set(Object.values(CHAPTER3_INTRO_PHASES).flatMap((phase) => phase.actors.map((actor) => actor.id as string)));
  assert(!visibleIds.has("player") && !("player" in CHAPTER3_STAGE_SPRITES), "player must never be drawn (first-person)");
  // warp: transfer circles only under the six visible travelling NPCs (researcher stays; no empty player marker)
  for (const phase of ["hq-warp-charge", "hq-warp-peak", "hq-warp-flash"]) {
    const circled = CHAPTER3_INTRO_PHASES[phase].actors.filter((actor) => actor.circle).map((actor) => actor.id).sort();
    assert(circled.join() === "aron,deneb,kaiden,kapp,luna,theo", `6 circles in ${phase}`);
  }
  assert(CHAPTER3_INTRO_PHASES["hq-gather"].actors.map((a) => a.id).join() === "theo,luna,aron,kapp", "HQ starts with the four only");
  assert(CHAPTER3_INTRO_PHASES["arrival-landing"].actors.length === 0, "arrival opens on the empty landing (player is the viewer)");
  assert(CHAPTER3_INTRO_PHASES["arrival-kaiden"].actors.map((a) => a.id).join() === "kaiden", "Kaiden warps in alone");
  assert(CHAPTER3_INTRO_PHASES["arrival-regroup"].actors.map((a) => a.id).sort().join() === "deneb,kaiden", "Deneb and Kaiden at regroup");

  // HQ: Deneb/Kaiden right of the four, no sprite overlap (visible pixel widths), no gaps in the line
  const hq = CHAPTER3_INTRO_PHASES["hq-researcher"].actors;
  const span = (id: string) => { const actor = hq.find((a) => a.id === id)!; const width = CHAPTER3_STAGE_SPRITES[actor.id].frameWidth * STAGE_SPRITE_SCALE * 0.82; return [actor.x - width / 2, actor.x + width / 2]; };
  for (const id of ["deneb", "kaiden"]) for (const other of hq.filter((a) => a.id !== id)) {
    const [a0, a1] = span(id); const [b0, b1] = span(other.id);
    assert(a1 <= b0 || b1 <= a0, `${id} overlaps ${other.id}`);
  }
  const four = ["theo", "luna", "aron", "kapp"].map((id) => hq.find((a) => a.id === id)!.x);
  const line = [...four, hq.find((a) => a.id === "deneb")!.x, hq.find((a) => a.id === "kaiden")!.x];
  assert(line.every((x, index) => index === 0 || (x > line[index - 1] && x - line[index - 1] <= 110)), "party line: four, then Deneb, Kaiden, evenly spaced");

  // camera: never shows outside the map for common viewports and every phase
  for (const [w, h] of [[1280, 720], [1366, 768], [1024, 768], [820, 1180], [2560, 1080], [390, 844]]) {
    for (const phase of Object.values(CHAPTER3_INTRO_PHASES)) {
      const c = clampCameraCenter(phase.camera, { width: w, height: h }, CHAPTER3_MAP_SIZE);
      const halfW = w / c.scale / 2, halfH = h / c.scale / 2;
      assert(c.x - halfW >= -1e-6 && c.x + halfW <= CHAPTER3_MAP_SIZE.width + 1e-6, `camera x edge ${w}x${h}`);
      assert(c.y - halfH >= -1e-6 && c.y + halfH <= CHAPTER3_MAP_SIZE.height + 1e-6, `camera y edge ${w}x${h}`);
    }
  }
  const home = CHAPTER3_INTRO_PHASES["arrival-regroup"].camera;
  assert(["arrival-look-return", "arrival-survey-return"].every((p) => { const c = CHAPTER3_INTRO_PHASES[p].camera; return c.x === home.x && c.y === home.y && c.zoom === home.zoom; }), "camera returns home");
  assert(STAGE_FOOT_Y.hq > 0 && STAGE_FOOT_Y.arrival > 0, "foot lines");

  // tram: 30–60 s waits, starts fully off the right and ends fully off the left
  const tram = CHAPTER3_BASE_CAMP_MAP.tram!;
  assert(rollTramDelayMs(0, tram.intervalSeconds) === 30_000 && rollTramDelayMs(1, tram.intervalSeconds) === 60_000, "tram delay range");
  assert(tramLeftAt(0, tram, CHAPTER3_BASE_CAMP_MAP.worldWidth) === CHAPTER3_BASE_CAMP_MAP.worldWidth, "tram enters from off-screen right");
  assert(tramLeftAt(tram.crossingSeconds * 1000, tram, CHAPTER3_BASE_CAMP_MAP.worldWidth) + tram.width === 0, "tram leaves fully on the left");
  assert(tram.crossingSeconds >= 10 && tram.crossingSeconds <= 15, "tram crossing 10–15 s");
  assert(CHAPTER3_BASE_CAMP_MAP.interactionRegions.length === 0 && !CHAPTER3_BASE_CAMP_MAP.layers.dungeonEntranceButton, "Phase 1: entrance is scenery only");
  assert(createChapter3BaseCampNpcs().map((npc) => npc.id).sort().join() === "deneb,kaiden", "base camp NPCs (player not drawn)");

  // save: separate keys, completion + name persisted, continue goes to the base camp
  assert(Object.values(SAVE_STORAGE_KEYS).every((key) => !UNIT2_SAVE_STORAGE_KEYS.includes(key as never)), "unit3 keys differ from unit2");
  const named = { ...createInitialGameSaveState(), playerState: { ...createInitialGameSaveState().playerState, name: "하늘" } };
  assert(resolveContinueScreen(named) === "story", "incomplete intro restarts");
  const done = applySaveDataToGameState(createSaveDataFromGameState(completeChapter3Intro(named)));
  assert(isChapter3IntroCompleted(done) && done.playerState.name === "하늘", "completion and name survive a save round trip");
  assert(resolveContinueScreen(done) === "baseCamp", "completed intro continues at the base camp");
  console.info("chapter3 intro/script/stage/camera/tram/save checks: PASS");
}
