import { createInitialGameSaveState, createSaveDataFromGameState, type GameSaveState } from "./save/saveStateAdapter";
import { completeChapter3Intro } from "./app/chapter3Flow";
import { getItemQuantity } from "./game/inventory/inventoryState";
import { getItemDefinition } from "./game/inventory/itemDefinitions";
import { getUnit3FloorAchievement, getUnit3SpecialRewardStatus, completeUnit3QuestWithSpecialReward, claimUnit3SpecialReward, recordUnit3CorrectAnswer } from "./game/chapter3/unit3Achievements";
import {
  UNIT3_FLOOR4_DEFENSE, UNIT3_FLOOR4_FLAGS, UNIT3_FLOOR4_ID, UNIT3_FLOOR4_QUEST_ID, UNIT3_FLOOR4_REWARD, applyFloor4Answer, completeUnit3Floor4Quest,
  createFloor4Defense, finishUnit3Floor4Run, getUnit3Floor4QuestPhase, isLunaAtBaseCamp, processFloor4Question, type Floor4DefenseState,
} from "./game/chapter3/unit3Floor4";
import { UNIT3_FLOOR3_QUEST_ID, isKafAtBaseCamp } from "./game/chapter3/unit3Floor3";
import { UNIT3_FLOOR4_QUESTIONS, UNIT3_FLOOR4_QUESTIONS_ARE_INTERIM, drawUnit3Floor4Questions } from "./data/chapter3/floor4Questions";
import { createUnit3DebugStart } from "./debug/unit3DebugStart";
import { createChapter3BaseCampHitboxes, createChapter3BaseCampNpcs } from "./data/chapter3/chapter3BaseCamp";
import { DEBUG_SESSION_SAVE_KEY, LEGACY_MIGRATION_DONE_KEY, LEGACY_UNIT3_SAVE_STORAGE_KEYS, SAVE_STORAGE_KEYS, UNIT2_SAVE_STORAGE_KEYS, UNIT3_SAVE_UNIT_ID } from "./save/saveConstants";
import { SaveManager, isUnit3RawSave, migrateLegacyUnit3Save, setSaveDebugSession } from "./save/SaveManager";
import { FakeAudio, withFakeAudio } from "./bgmFollowupChecks";
import { getBgmDebugState, fadeOutBgm, playBgm, setBgmLevel } from "./game/audioBgm";
import { U4_LAYOUT, U4_POSES } from "./game/chapter3/floor4/Unit3Floor4Screen";
import { poseWidth } from "./game/chapter3/eventMap/eventMapActor";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[chapter3Phase5Checks] ${message}`);
}

/** Answers question `index` and confirms it (one processed question). */
function step(state: Floor4DefenseState, index: number, correct: boolean) {
  const answered = applyFloor4Answer(state, index, correct);
  return processFloor4Question(answered, index);
}

function defenseChecks() {
  const D = UNIT3_FLOOR4_DEFENSE;
  assert(D.total === 12 && D.initial === 60 && D.max === 100 && D.correct === 10 && D.wrong === -15, "defense numbers");
  // clamp 0–100
  let s = createFloor4Defense();
  const events: string[] = [];
  for (let i = 0; i < 12; i += 1) { const r = step(s, i, true); s = r.state; if (r.event) events.push(`${i + 1}:${r.event}`); }
  assert(s.shield === 100, "shield clamps at 100");
  assert(events.join() === "3:talk3,6:evacuate6,12:success", `events at 3 / 6 / 12 once each (${events.join()})`);
  // double answer / double confirm ignored
  s = createFloor4Defense();
  const once = applyFloor4Answer(s, 0, false);
  assert(applyFloor4Answer(once, 0, true) === once && applyFloor4Answer(once, 0, false) === once, "a second answer to the same question is ignored");
  const confirmed = processFloor4Question(once, 0).state;
  assert(processFloor4Question(confirmed, 0).state === confirmed && confirmed.processed === 1 && confirmed.shield === 45, "a second confirm is ignored; exactly one change per question");
  assert(applyFloor4Answer(confirmed, 5, true) === confirmed, "answers to a question that is not current are ignored");
  // failure: 60 → 45 → 30 → 15 → 0 at question 4; fail fires at once (before the 3-question talk... and every later event)
  s = createFloor4Defense();
  const fails: (string | null)[] = [];
  for (let i = 0; i < 4; i += 1) { const r = step(s, i, false); s = r.state; fails.push(r.event); }
  assert(fails.join() === ",,talk3,fail" && s.failed && s.shield === 0, `four wrong answers fail on the 4th (${fails.join()})`);
  assert(applyFloor4Answer(s, 4, true) === s, "no answers after the failure");
  // failure takes priority over the 6-question evacuation and the 12th result
  let p = createFloor4Defense();
  for (let i = 0; i < 5; i += 1) p = step(p, i, i % 2 === 0).state; // 70 55 65 50 60
  p = { ...p, shield: 15 };
  const r6 = step(p, 5, false);
  assert(r6.event === "fail" && !r6.state.firedEvents.includes("evacuate6"), "failure beats the 6-question event");
  let q = createFloor4Defense();
  for (let i = 0; i < 11; i += 1) q = step(q, i, true).state;
  q = { ...q, shield: 10 };
  assert(step(q, 11, false).event === "fail", "shield 0 at question 12 is a failure");
  q = { ...q, shield: 16 };
  assert(step(q, 11, false).event === "success" && step(q, 11, false).state.shield === 1, "shield ≥ 1 after 12 questions is a success");
}

function questionChecks() {
  assert(UNIT3_FLOOR4_QUESTIONS_ARE_INTERIM && UNIT3_FLOOR4_QUESTIONS.length >= 12, "interim Floor 4 pool (≥ 12)");
  const a = drawUnit3Floor4Questions(12, () => 0.3), b = drawUnit3Floor4Questions(12, () => 0.7);
  assert(new Set(a.map((x) => x.id)).size === 12 && a.length === 12, "12 distinct questions per attempt");
  assert(a.map((x) => x.id).join() !== b.map((x) => x.id).join(), "retry draws again");
}

function rewardChecks() {
  const start = createUnit3DebugStart(UNIT3_FLOOR4_ID, "early").state;
  assert(start.questState[UNIT3_FLOOR3_QUEST_ID] === "completed" && isKafAtBaseCamp(start) && getUnit3Floor4QuestPhase(start) === "notAccepted", "Debug 4층 초반: Floors 1–3 done, 카프 joined, quest offered");
  assert(!isLunaAtBaseCamp(start), "루나 not at the camp before Floor 4");
  const late = createUnit3DebugStart(UNIT3_FLOOR4_ID, "late");
  assert(late.enterDungeon && late.floorRun === null && late.state.questState[UNIT3_FLOOR4_QUEST_ID] === "active"
    && late.state.firstObjectiveEventSeen[UNIT3_FLOOR4_FLAGS.defenseReady] && !isLunaAtBaseCamp(late.state) && !late.state.rewardClaimed[UNIT3_FLOOR4_QUEST_ID], "Debug 4층 후반: defense ready, 루나 not joined, no reward");
  // a failed attempt / camp return gives nothing
  assert(completeUnit3Floor4Quest(late.state) === late.state, "no report before the success story");
  const finished = finishUnit3Floor4Run(late.state);
  assert(isLunaAtBaseCamp(finished) && getUnit3Floor4QuestPhase(finished) === "readyToComplete", "success → 루나 joins, report ready");
  const npcs = createChapter3BaseCampNpcs({ kaf: true, luna: true });
  const boxes = createChapter3BaseCampHitboxes(npcs);
  assert(npcs.find((npc) => npc.id === "luna")?.displayRole === "정찰요원" && boxes.luna, "루나 at the camp as 정찰요원 with a hitbox");
  const overlap = (k: keyof typeof boxes) => boxes[k] && boxes.luna && boxes[k]!.x < boxes.luna.x + boxes.luna.width && boxes.luna.x < boxes[k]!.x + boxes[k]!.width;
  assert(!overlap("kaiden") && !overlap("supply") && !overlap("deneb") && !overlap("kaf"), "루나 does not overlap other NPCs");
  // report: 10 G + achievement once; special reward at 8 distinct correct answers, never twice
  const spec = getUnit3FloorAchievement(UNIT3_FLOOR4_ID)!;
  assert(spec.requiredCorrect === 8 && spec.rewardItemId === UNIT3_FLOOR4_REWARD.weaponItemId && getItemDefinition(spec.rewardItemId)?.type === "weaponSkin", "special reward spec (3·1 운동 태극기, 8)");
  let seven: GameSaveState = finished;
  for (const question of UNIT3_FLOOR4_QUESTIONS.slice(0, 7)) seven = recordUnit3CorrectAnswer(seven, UNIT3_FLOOR4_ID, question.id);
  seven = recordUnit3CorrectAnswer(seven, UNIT3_FLOOR4_ID, UNIT3_FLOOR4_QUESTIONS[0].id); // duplicate: still 7
  const reported = completeUnit3QuestWithSpecialReward(seven, UNIT3_FLOOR4_ID, completeUnit3Floor4Quest);
  assert(reported.playerState.gold === finished.playerState.gold + 10 && getItemQuantity(reported.inventoryState, spec.rewardItemId) === 0, "report with 7 correct: 10 G, flag not yet");
  assert(completeUnit3QuestWithSpecialReward(reported, UNIT3_FLOOR4_ID, completeUnit3Floor4Quest) === reported, "no second report");
  const eight = recordUnit3CorrectAnswer(reported, UNIT3_FLOOR4_ID, UNIT3_FLOOR4_QUESTIONS[7].id);
  assert(getUnit3SpecialRewardStatus(eight, spec).canClaim, "8th correct answer → claimable in the achievement window");
  const claimed = claimUnit3SpecialReward(eight, UNIT3_FLOOR4_ID);
  assert(getItemQuantity(claimed.inventoryState, spec.rewardItemId) === 1 && claimUnit3SpecialReward(claimed, UNIT3_FLOOR4_ID) === claimed, "special reward granted once");
}

function layoutChecks() {
  const P = U4_POSES, L = U4_LAYOUT;
  const row: [number, number][] = [
    [L.defense.deneb, poseWidth(P.denebDefense)], [L.defense.kaiden, poseWidth(P.kaiden)],
    ...Object.entries(L.crowd).map(([id, x]) => [x, poseWidth(P[id === "female2" || id === "yu" ? "female" : id === "liaison" ? "male" : id])] as [number, number]),
    [L.defense.kaf, poseWidth(P.kafDefense)], [L.defense.luna, poseWidth(P.lunaDefense)],
  ];
  for (let i = 1; i < row.length; i += 1) {
    const gap = (row[i][0] - row[i][1] / 2) - (row[i - 1][0] + row[i - 1][1] / 2);
    assert(gap >= 0, `defense row: person ${i} does not overlap the previous one (gap ${gap.toFixed(1)})`);
  }
  assert(L.shieldLeft < L.defense.deneb - poseWidth(P.denebDefense) / 2 && L.shieldRight > L.defense.luna + poseWidth(P.lunaDefense) / 2, "shields outside the formation");
}

/** In-memory Storage. */
class MemoryStorage {
  map = new Map<string, string>();
  get length() { return this.map.size; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { throw new Error("localStorage.clear() must never be called"); }
}
function withStorage(body: (local: MemoryStorage, session: MemoryStorage) => void) {
  const scope = window as unknown as Record<string, unknown>;
  const original = { local: Object.getOwnPropertyDescriptor(scope, "localStorage"), session: Object.getOwnPropertyDescriptor(scope, "sessionStorage") };
  const local = new MemoryStorage(), session = new MemoryStorage();
  Object.defineProperty(scope, "localStorage", { value: local, configurable: true });
  Object.defineProperty(scope, "sessionStorage", { value: session, configurable: true });
  try { body(local, session); } finally {
    if (original.local) Object.defineProperty(scope, "localStorage", original.local); else delete scope.localStorage;
    if (original.session) Object.defineProperty(scope, "sessionStorage", original.session); else delete scope.sessionStorage;
    setSaveDebugSession(false);
  }
}

function saveChecks() {
  const unit3 = createSaveDataFromGameState(completeChapter3Intro({ ...createInitialGameSaveState(), playerState: { ...createInitialGameSaveState().playerState, name: "별" } }));
  // a Unit 1/2-style save: same schema, a name, no Unit 3 progress
  const other = createSaveDataFromGameState({ ...createInitialGameSaveState(), playerState: { ...createInitialGameSaveState().playerState, name: "다른단원" } });
  assert(isUnit3RawSave(unit3) && !isUnit3RawSave(other), "Unit 3 evidence: intro / unit3 ids; other units rejected");
  assert(!isUnit3RawSave({ ...unit3, saveUnit: "AdventureAcademy5-2-2" }) && isUnit3RawSave({ ...other, saveUnit: UNIT3_SAVE_UNIT_ID }), "the unit marker decides when present");
  assert(Object.values(SAVE_STORAGE_KEYS).every((key) => !UNIT2_SAVE_STORAGE_KEYS.includes(key as never) && !Object.values(LEGACY_UNIT3_SAVE_STORAGE_KEYS).includes(key as never)), "new Unit 3 keys");

  // other units' data (any key) never shows as 이어하기
  withStorage((local) => {
    UNIT2_SAVE_STORAGE_KEYS.forEach((key) => local.setItem(key, JSON.stringify(other)));
    local.setItem(LEGACY_UNIT3_SAVE_STORAGE_KEYS.main, JSON.stringify(other)); // not certainly Unit 3: not migrated
    assert(!SaveManager.load().success, "other units' saves are not Unit 3's 이어하기");
    assert(local.getItem(SAVE_STORAGE_KEYS.main) === null && local.getItem(LEGACY_UNIT3_SAVE_STORAGE_KEYS.main) === JSON.stringify(other), "nothing copied, old key untouched");
    SaveManager.save(unit3);
    SaveManager.clear();
    assert(UNIT2_SAVE_STORAGE_KEYS.every((key) => local.getItem(key) === JSON.stringify(other)) && local.getItem(LEGACY_UNIT3_SAVE_STORAGE_KEYS.main) !== null, "새로 시작하기 clears only the Unit 3 slots");
    assert(!SaveManager.importJson(JSON.stringify(other)).success, "another unit's export is not imported");
  });
  // existing Unit 3 save on the old key: copied once, old key kept, never over a new save
  withStorage((local) => {
    const old = JSON.stringify(unit3);
    local.setItem(LEGACY_UNIT3_SAVE_STORAGE_KEYS.main, old);
    const loaded = SaveManager.load();
    assert(loaded.success && loaded.data.player.name === "별", "old Unit 3 save continues");
    assert(local.getItem(LEGACY_UNIT3_SAVE_STORAGE_KEYS.main) === old && JSON.parse(local.getItem(SAVE_STORAGE_KEYS.main)!).saveUnit === UNIT3_SAVE_UNIT_ID, "copied with the unit marker; old key kept");
    SaveManager.clear();
    assert(!SaveManager.load().success && local.getItem(LEGACY_MIGRATION_DONE_KEY) === "1", "after 새로 시작하기 the old save is not copied back");
  });
  withStorage((local) => {
    const mine = JSON.stringify({ ...unit3, player: { ...unit3.player, name: "새것" }, saveUnit: UNIT3_SAVE_UNIT_ID });
    local.setItem(SAVE_STORAGE_KEYS.main, mine);
    local.setItem(LEGACY_UNIT3_SAVE_STORAGE_KEYS.main, JSON.stringify(unit3));
    assert(migrateLegacyUnit3Save(local as unknown as Storage).copied === 0 && local.getItem(SAVE_STORAGE_KEYS.main) === mine, "an existing new save is never overwritten");
  });
  // Debug session: sessionStorage (Unit 3 key) only; the normal save is untouched
  withStorage((local, session) => {
    SaveManager.save(unit3);
    const before = local.getItem(SAVE_STORAGE_KEYS.main);
    setSaveDebugSession(true);
    SaveManager.save({ ...unit3, player: { ...unit3.player, name: "DEBUG" } });
    SaveManager.clear();
    setSaveDebugSession(false);
    assert(local.getItem(SAVE_STORAGE_KEYS.main) === before && session.getItem(DEBUG_SESSION_SAVE_KEY)?.includes("DEBUG") && DEBUG_SESSION_SAVE_KEY.startsWith("adventure-academy-5-2-3:"), "debug session isolated");
  });
}

function bgmChecks() {
  withFakeAudio(() => {
    playBgm("unit3-dungeon4", undefined, { loop: true, volume: 0.42, fadeInMs: 1500 });
    const track = FakeAudio.instances[0];
    track.currentTime = 41;
    setBgmLevel(1, 1500, "unit3-dungeon4");
    setBgmLevel(0.7, 600, "unit3-dungeon4");
    playBgm("unit3-dungeon4", undefined, { loop: true, volume: 0.42 });
    setBgmLevel(0.4, 2000, "unit3-dungeon4");
    void fadeOutBgm(1500, "unit3-dungeon4"); // game over …
    playBgm("unit3-dungeon4", undefined, { loop: true, volume: 0.42 }); // … retry: same element comes back
    assert(FakeAudio.instances.length === 1 && track.playCalls <= 2 && track.currentTime === 41 && track.loop && !getBgmDebugState().fadingOut, "Floor 4 BGM: one instance, level changes never restart or reset it");
  });
}

export function runChapter3Phase5Checks() {
  defenseChecks();
  questionChecks();
  rewardChecks();
  layoutChecks();
  saveChecks();
  bgmChecks();
}
