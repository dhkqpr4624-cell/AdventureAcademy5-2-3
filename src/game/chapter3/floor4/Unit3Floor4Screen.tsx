import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScreenId } from "../../../app/routes";
import { StoryPlayer } from "../../story/StoryPlayer";
import { QuestionScreen } from "../../../screens/QuestionScreen/QuestionScreen";
import { PlayerDefeatedOverlay } from "../../../components/PlayerDefeatedOverlay";
import type { PlayerState } from "../../player/playerState";
import type { Question } from "../../../types/question";
import type { StorySequence } from "../../../types/story";
import { fadeOutBgm, getBgmDebugState, playBgm, setBgmLevel } from "../../audioBgm";
import { playBarrierImpact, playBarrierSpawn, playUnit3SfxFile, preloadUnit3SfxFile, type Chapter3SfxHandle } from "../../audio/chapter3ProceduralSfx";
import { GridSprite } from "../eventMap/GridSprite";
import { U3EM_IMAGES, U3EM_POSES, U3EM_SCENE } from "../eventMap/Unit3Floor3EventMap";
import { EventMapActor, decodeImages, type EventMapActorState, type EventMapPose } from "../eventMap/eventMapActor";
import { UNIT3_FLOOR4_SEGMENTS, UNIT3_FLOOR4_SHANGHAI_STORY, UNIT3_FLOOR4_STAGE_ID, UNIT3_FLOOR4_TAPGOL_STORY, UNIT3_FLOOR4_PORTRAIT_URLS, type Unit3Floor4SegmentKey } from "../../../data/chapter3/floor4Stories";
import { drawUnit3Floor4Questions } from "../../../data/chapter3/floor4Questions";
import { UNIT3_FLOOR4_DEFENSE, applyFloor4Answer, createFloor4Defense, isFloor4FinalStretch, processFloor4Question, type Floor4DefenseState } from "../unit3Floor4";
import { Unit3Floor4Caption, Unit3Floor4Stage, UNIT3_FLOOR4_STAGE_IMAGE_URLS } from "./Unit3Floor4Stage";

/**
 * Phase 5 · Unit 3 Floor 4 — the whole floor in one dedicated screen (no 3D dungeon, no monster fights, no
 * player standing / weapon / HP / potion UI; the enemy is only off-screen voices, whistles, boots and attack VFX):
 *
 *   탑골공원 (illustration stage) → 아우내 장터 event map (entrance, 루나 발견, 포위, 보호막 생성)
 *   → 12-question shield defense (rules: unit3Floor4.ts) → fail: collapse + game over (retry / camp)
 *   → success: scripted collapse, 체포, 안전한 골목, 기록의 문, 대한민국 임시정부, 루나의 선택 → base camp.
 *
 * The event map reuses the Floor 3 escape-map pieces: one 2172×724 scene, ground / foreground / background
 * layers, people placed by their visible alpha box (EventMapActor), turn-then-walk moves with the CSS walk,
 * GridSprite for every sprite sheet (Floor 3 barrier sheets mirrored for the right shield, the Unit 2
 * exclamation sheet, Floor 4 PixelFX sheets). React state changes only at cues, never per frame.
 *
 * One bottom-right 「건너뛰기」: story before the defense → the defense start; the defense itself → no skip;
 * stories between questions → the next question; after the success → finished (루나 joins); failure → game over.
 * Each skip puts the people, poses, shields, VFX, BGM level and flags into that section's normal end state.
 * BGM: the single Strong track, started after the 만세 recording ends and only ramped (setBgmLevel).
 */

const BASE = import.meta.env.BASE_URL;
const F4 = `${BASE}assets/chapter3/floor4/`;
const SFX = `${BASE}assets/audio/sfx/unit3-f4/`;
export const U4_SFX = {
  murmur: `${SFX}crowd-murmur.mp3`, manse: `${SFX}crowd-manse.mp3`,
  declaration1: `${SFX}declaration-01.mp3`, declaration2: `${SFX}declaration-02.mp3`,
  command1: `${SFX}command-japanese-01.mp3`, command2: `${SFX}command-japanese-02.mp3`,
  whistle: `${SFX}military-whistle.wav`, footsteps: `${SFX}military-footsteps.wav`,
  rumble: `${SFX}heavy-rumble.wav`, impact: `${SFX}heavy-impact.wav`,
} as const;
/** Levels from each file's loudness (ffmpeg ebur128), so the recordings sit together under the Unit 3 SFX bus. */
const SFX_LEVEL = { murmur: 0.3, manse: 0.62, declaration1: 0.5, declaration2: 0.52, command1: 0.3, command2: 0.3, whistle: 0.14, footsteps: 0.7, rumble: 0.42, impact: 0.3 } as const;
/** BGM levels relative to the track's scene volume: story ≈ 40 %, defense 100 %, talk between questions 70 %. */
export const U4_BGM = { id: "unit3-dungeon4" as const, story: 0.4, defense: 1, talk: 0.7, rampMs: 1500 };

export const U4_IMAGES = {
  background: `${F4}eventmap/background.png`, wall: `${F4}eventmap/foreground.png`, ground: `${F4}eventmap/ground.png`,
  lightFlow: `${F4}vfx/light-flow.png`, recordDoor: `${F4}vfx/record-door.png`, attack: `${F4}vfx/incoming-attack.png`,
  shockwave: `${F4}vfx/giant-shockwave.png`, rift: `${F4}vfx/dungeon-rift.png`, crack: `${F4}vfx/shield-crack.png`,
} as const;

const pose = (src: string, w: number, h: number, box: [number, number, number, number], visibleH: number, natural: "L" | "R" = "R"): EventMapPose =>
  ({ src, w, h, left: box[0], top: box[1], right: box[2], bottom: box[3], natural, visibleH });
/** Supplied Floor 4 people (alpha > 128 boxes measured from the PNGs). */
export const U4_POSES: Record<string, EventMapPose> = {
  deneb: U3EM_POSES.deneb, denebDefense: U3EM_POSES.denebDefense,
  // No 카이든 defense pose was supplied: his standing (natural facing left) is used while he defends.
  kaiden: U3EM_POSES.kaiden, kafAcademy: U3EM_POSES.kafAcademy, kafDefense: U3EM_POSES.kafDefense,
  luna: pose(`${F4}standing/luna-period.png`, 1160, 1355, [127, 55, 968, 1327], 226),
  lunaDefense: pose(`${F4}standing/luna-period-defense-R.png`, 1160, 1355, [141, 71, 1056, 1314], 232),
  elder: pose(`${F4}standing/protester-elder.png`, 1160, 1355, [205, 48, 1070, 1342], 208),
  female: pose(`${F4}standing/protester-female.png`, 1160, 1355, [140, 56, 1098, 1332], 218),
  male: pose(`${F4}standing/protester-male.png`, 1160, 1355, [243, 24, 1067, 1335], 228),
  student: pose(`${F4}standing/protester-student.png`, 1160, 1355, [232, 27, 1002, 1332], 216),
  crouch: pose(`${F4}standing/resident-crouch.png`, 262, 239, [22, 6, 245, 238], 150),
  fallenFemale: pose(`${F4}standing/resident-fallen-female.png`, 511, 341, [9, 50, 500, 325], 86),
  fallenMale: pose(`${F4}standing/resident-fallen-male.png`, 306, 204, [18, 36, 289, 192], 74),
};
export const U4_IMAGE_URLS: string[] = [...new Set([
  ...Object.values(U4_IMAGES), ...Object.values(U4_POSES).map((p) => p.src),
  U3EM_IMAGES.barrierSpawn, U3EM_IMAGES.barrierHold, U3EM_IMAGES.barrierImpact, U3EM_IMAGES.barrierDespawn, U3EM_IMAGES.exclamation,
])];
export const U4_ALL_PRELOAD_URLS: string[] = [...U4_IMAGE_URLS, ...UNIT3_FLOOR4_STAGE_IMAGE_URLS, ...UNIT3_FLOOR4_PORTRAIT_URLS];

type ActorId = "deneb" | "kaiden" | "kaf" | "luna" | "elder" | "male" | "female2" | "yu" | "student" | "liaison" | "fallenA" | "fallenB" | "pair";
const G = U3EM_SCENE.groundY;
/** Scene x of each person (visible-box centres, ≥ 12 units apart; see checks). Exit = the gate in the middle of the back row. */
export const U4_LAYOUT = {
  shieldLeft: 230, shieldRight: 1950, exitX: 1190,
  entrance: { deneb: 150, kaf: 317, kaiden: 484 },
  defense: { deneb: 340, kaiden: 519, kaf: 1646, luna: 1840 },
  crowd: { elder: 674, male: 828, female2: 993, yu: 1169, student: 1327, liaison: 1474 },
  fallen: { fallenA: 993, fallenB: 1327, pair: 674 },
  alley: { pair: 700, elder: 867, luna: 1036, deneb: 1208, kaf: 1375, kaiden: 1542 },
  door: { x: 1830, luna: 1150, deneb: 1322, kaf: 1490, kaiden: 1655 },
  entranceDistance: 900,
} as const;
const ACTOR_POSE: Record<ActorId, string> = {
  deneb: "deneb", kaiden: "kaiden", kaf: "kafAcademy", luna: "luna", elder: "elder", male: "male", female2: "female", yu: "female", student: "student", liaison: "male",
  fallenA: "fallenFemale", fallenB: "fallenMale", pair: "crouch",
};
const BARRIER = { w: 128, h: 256, scale: 1.36, bottomEndX: 86, bottomEndY: 240, apexX: 40, contactY: 150 } as const;
const shieldTop = G - BARRIER.bottomEndY * BARRIER.scale;
const shieldApex = (side: "L" | "R") => side === "L"
  ? U4_LAYOUT.shieldLeft - (BARRIER.bottomEndX - BARRIER.apexX) * BARRIER.scale
  : U4_LAYOUT.shieldRight + (BARRIER.bottomEndX - BARRIER.apexX) * BARRIER.scale;
const contactY = shieldTop + BARRIER.contactY * BARRIER.scale;

type Shield = { phase: "none" | "spawn" | "hold" | "despawn"; impact: number; shake: number; pulse: number };
type Fx = { id: number; kind: "attack" | "beam" | "shockwave" | "crack"; side: "L" | "R"; from?: number };
type Scene = {
  actors: Record<ActorId, EventMapActorState>;
  shields: Record<"L" | "R", Shield>;
  fx: Fx[]; rifts: boolean; door: boolean; alarms: Partial<Record<ActorId, number>>; shadows: ActorId[];
  curtain: boolean; curtainMs: number; flash: number; quake: number; tint: boolean;
};
const actor = (id: ActorId, x: number, facing: "L" | "R", z: number, shown = true): EventMapActorState =>
  ({ pose: ACTOR_POSE[id], x, facing, shown, moveMs: 0, fadeMs: 600, z, walking: false, pace: "walk" });
const crowdScene = (): Record<ActorId, EventMapActorState> => {
  const C = U4_LAYOUT.crowd, E = U4_LAYOUT.entrance, D = U4_LAYOUT.entranceDistance, F = U4_LAYOUT.fallen;
  return {
    deneb: actor("deneb", E.deneb - D, "R", 6), kaf: actor("kaf", E.kaf - D, "R", 7), kaiden: actor("kaiden", E.kaiden - D, "R", 8),
    luna: actor("luna", U4_LAYOUT.defense.luna, "L", 7, false),
    elder: actor("elder", C.elder, "L", 3), male: actor("male", C.male, "R", 4), female2: actor("female2", C.female2, "L", 3),
    yu: actor("yu", C.yu, "R", 5), student: actor("student", C.student, "L", 4), liaison: actor("liaison", C.liaison, "L", 3),
    fallenA: actor("fallenA", F.fallenA, "R", 2, false), fallenB: actor("fallenB", F.fallenB, "L", 2, false), pair: actor("pair", F.pair, "R", 2, false),
  };
};
/** The defense formation (also the state every skip / retry into the defense starts from). */
const defenseActors = (): Record<ActorId, EventMapActorState> => {
  const base = crowdScene(), P = U4_LAYOUT.defense;
  return {
    ...base,
    deneb: { ...base.deneb, x: P.deneb, facing: "L", pose: "denebDefense" },
    kaiden: { ...base.kaiden, x: P.kaiden, facing: "L", pose: "kaiden" },
    kaf: { ...base.kaf, x: P.kaf, facing: "R", pose: "kafDefense" },
    luna: { ...base.luna, x: P.luna, facing: "R", pose: "lunaDefense", shown: true },
  };
};
const freshShields = (phase: Shield["phase"]): Record<"L" | "R", Shield> => ({ L: { phase, impact: 0, shake: 0, pulse: 0 }, R: { phase, impact: 0, shake: 0, pulse: 0 } });
const initialScene = (): Scene => ({ actors: crowdScene(), shields: freshShields("none"), fx: [], rifts: false, door: false, alarms: {}, shadows: [], curtain: true, curtainMs: 0, flash: 0, quake: 0, tint: false });

class Cancelled extends Error {}
type UiMode = "none" | "guide" | "title" | "question" | "success" | "gameover";
type Section = { skipped: boolean; cancelled: boolean; timers: Set<number>; reject: Set<(error: Error) => void> };

export type Unit3Floor4ScreenProps = {
  playerName: string;
  playerStatus?: PlayerState;
  /** the story up to the shield creation was seen before (or skipped) */
  defenseReady: boolean;
  /** the floor was already cleared (replay: defense only, no story after the success) */
  cleared: boolean;
  onNavigate: (screen: ScreenId) => void;
  onQuestionCorrect: (questionId: string) => void;
  onDefenseReady: () => void;
  /** success + the whole post-success story (played or skipped): save flags (루나 joins) and go to the camp */
  onCleared: () => void;
  onReturnToCamp: () => void;
};

export function Unit3Floor4Screen({ playerName, playerStatus, defenseReady, cleared, onNavigate, onQuestionCorrect, onDefenseReady, onCleared, onReturnToCamp }: Unit3Floor4ScreenProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ w: 1280, h: 720, boxTop: 517 });
  const [scene, setScene] = useState<Scene>(initialScene);
  const [stagePhase, setStagePhase] = useState<"tapgol" | "map" | "shanghai">(defenseReady ? "map" : "tapgol");
  const [story, setStory] = useState<{ key: string; sequence: StorySequence } | null>(null);
  const [caption, setCaption] = useState<{ text: string; holdMs: number } | null>(null);
  const [ui, setUi] = useState<UiMode>("none");
  const [skippable, setSkippable] = useState(false);
  const [defense, setDefense] = useState<Floor4DefenseState>(createFloor4Defense);
  const [questions, setQuestions] = useState<Question[]>(() => drawUnit3Floor4Questions());
  const [attempt, setAttempt] = useState(1);
  const defenseRef = useRef(defense);
  defenseRef.current = defense;
  const sectionRef = useRef<Section | null>(null);
  const storyDone = useRef<(() => void) | null>(null);
  const uiDone = useRef<(() => void) | null>(null);
  const skipRef = useRef<(() => void) | null>(null);
  const unmounted = useRef(false);
  const sounds = useRef(new Set<Chapter3SfxHandle>());
  const voice = useRef<Chapter3SfxHandle | null>(null);
  const murmur = useRef<Chapter3SfxHandle | null>(null);
  const manseEnded = useRef<Promise<void> | null>(null);
  const fxId = useRef(0);
  const callbacks = useRef({ onQuestionCorrect, onDefenseReady, onCleared, onReturnToCamp });
  callbacks.current = { onQuestionCorrect, onDefenseReady, onCleared, onReturnToCamp };

  /* ------------------------------------------------------------ viewport (state changes only on resize) */
  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const measure = () => {
      const h = element.clientHeight || 720;
      const probe = probeRef.current;
      setViewport({ w: element.clientWidth || 1280, h, boxTop: probe ? probe.getBoundingClientRect().top - element.getBoundingClientRect().top : h * 0.72 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  // The whole formation (both shields) always fits the width; story: feet above the dialogue box; defense: the
  // question panel is at the top and the people stand at the bottom (feet stay visible below the panel).
  const defenseLayout = ui === "question" || ui === "guide" || ui === "title";
  const safeFeetY = defenseLayout ? viewport.h - 18 : Math.max(60, viewport.boxTop - 10);
  const scale = Math.max(viewport.w / U3EM_SCENE.width, Math.min((viewport.h * 0.74) / U3EM_SCENE.height, viewport.w / 1990, safeFeetY / G));
  const sceneTop = safeFeetY - G * scale;
  const visibleW = viewport.w / scale;
  const cameraX = Math.max(0, Math.min(U3EM_SCENE.width - visibleW, 1090 - visibleW / 2));

  /* ------------------------------------------------------------ audio helpers */
  const sfx = useCallback((key: keyof typeof U4_SFX, options: { loop?: boolean; fadeInMs?: number } = {}) => {
    const handle = playUnit3SfxFile(U4_SFX[key], { level: SFX_LEVEL[key], ...options });
    sounds.current.add(handle);
    void handle.ended.then(() => sounds.current.delete(handle));
    return handle;
  }, []);
  const stopVoice = () => { voice.current?.stop(200); voice.current = null; };
  const startBgm = (level: number) => {
    // same id → the same element keeps playing (a fade-out in progress is reversed); never a second instance
    playBgm(U4_BGM.id, undefined, { loop: true, volume: 0.42, fadeInMs: U4_BGM.rampMs });
    setBgmLevel(level, U4_BGM.rampMs, U4_BGM.id);
  };
  const stopSounds = useCallback((fadeMs = 200) => {
    sounds.current.forEach((handle) => handle.stop(fadeMs));
    sounds.current.clear();
    voice.current = null; murmur.current = null;
  }, []);

  /* ------------------------------------------------------------ sections (skip / cancel) */
  const wait = (ms: number) => new Promise<void>((resolve, reject) => {
    const section = sectionRef.current;
    if (!section || section.cancelled) { reject(new Cancelled()); return; }
    const id = window.setTimeout(() => { section.timers.delete(id); section.reject.delete(reject); if (section.cancelled) reject(new Cancelled()); else resolve(); }, ms);
    section.timers.add(id); section.reject.add(reject);
  });
  const cancelSection = (skipped: boolean) => {
    const section = sectionRef.current;
    if (!section || section.cancelled) return;
    section.cancelled = true; section.skipped = skipped;
    section.timers.forEach((id) => window.clearTimeout(id));
    const rejects = [...section.reject];
    section.timers.clear(); section.reject.clear();
    storyDone.current = null; uiDone.current = null;
    setStory(null);
    rejects.forEach((reject) => reject(new Cancelled()));
  };
  /** Runs one section. If 「건너뛰기」 is pressed (skippable sections only), `toEnd` sets its normal end state. */
  const runSection = async (canSkip: boolean, body: () => Promise<void>, toEnd: () => void | Promise<void>) => {
    const section: Section = { skipped: false, cancelled: false, timers: new Set(), reject: new Set() };
    sectionRef.current = section;
    skipRef.current = canSkip ? () => cancelSection(true) : null;
    setSkippable(canSkip);
    try {
      await body();
    } catch (error) {
      if (!(error instanceof Cancelled)) throw error;
      if (!section.skipped || unmounted.current) throw error;
      await toEnd();
    } finally {
      if (sectionRef.current === section) { skipRef.current = null; setSkippable(false); }
    }
  };
  const say = (key: Unit3Floor4SegmentKey | "tapgol" | "shanghai") => new Promise<void>((resolve, reject) => {
    const section = sectionRef.current;
    if (!section || section.cancelled) { reject(new Cancelled()); return; }
    section.reject.add(reject);
    storyDone.current = () => { storyDone.current = null; section.reject.delete(reject); setStory(null); resolve(); };
    const sequence = key === "tapgol" ? UNIT3_FLOOR4_TAPGOL_STORY : key === "shanghai" ? UNIT3_FLOOR4_SHANGHAI_STORY : UNIT3_FLOOR4_SEGMENTS[key];
    setStory({ key, sequence });
  });
  const waitUi = (mode: UiMode) => new Promise<void>((resolve, reject) => {
    const section = sectionRef.current;
    if (!section || section.cancelled) { reject(new Cancelled()); return; }
    section.reject.add(reject);
    uiDone.current = () => { uiDone.current = null; section.reject.delete(reject); resolve(); };
    setUi(mode);
  });

  /* ------------------------------------------------------------ scene helpers */
  const set = (update: (current: Scene) => Scene) => { if (!unmounted.current) setScene(update); };
  const patch = (id: ActorId, value: Partial<EventMapActorState>) => set((current) => ({ ...current, actors: { ...current.actors, [id]: { ...current.actors[id], ...value } } }));
  const at = useRef<Record<ActorId, number>>(Object.fromEntries(Object.entries(crowdScene()).map(([id, a]) => [id, a.x])) as Record<ActorId, number>);
  /** Turn to the walking direction → short beat → walk at a fixed pace → stop (facing kept). */
  const walkTo = (id: ActorId, x: number, hurry = false) => {
    const from = at.current[id];
    at.current[id] = x;
    const ms = Math.round((Math.abs(x - from) / (hurry ? 260 : 150)) * 1000);
    patch(id, { facing: x >= from ? "R" : "L" });
    const arrival = wait(160)
      .then(() => { patch(id, { x, moveMs: ms, walking: true, pace: hurry ? "hurry" : "walk" }); return wait(ms); })
      .then(() => patch(id, { walking: false, moveMs: 0 }));
    arrival.catch(() => undefined);
    return arrival;
  };
  const place = (actors: Record<ActorId, EventMapActorState>) => {
    (Object.keys(actors) as ActorId[]).forEach((id) => { at.current[id] = actors[id].x; });
    set((current) => ({ ...current, actors: Object.fromEntries(Object.entries(actors).map(([id, a]) => [id, { ...a, moveMs: 0, walking: false }])) as Record<ActorId, EventMapActorState> }));
  };
  const alarm = (...ids: ActorId[]) => set((current) => ({ ...current, alarms: { ...current.alarms, ...Object.fromEntries(ids.map((id) => [id, (current.alarms[id] ?? 0) + 1])) } }));
  const shields = (phase: Shield["phase"]) => set((current) => ({ ...current, shields: { L: { ...current.shields.L, phase }, R: { ...current.shields.R, phase } } }));
  const fx = (kind: Fx["kind"], side: "L" | "R", from?: number) => {
    const id = (fxId.current += 1);
    set((current) => ({ ...current, fx: [...current.fx, { id, kind, side, from }] }));
    return id;
  };
  const dropFx = (id: number) => set((current) => ({ ...current, fx: current.fx.filter((item) => item.id !== id) }));
  const curtain = (closed: boolean, ms: number) => set((current) => ({ ...current, curtain: closed, curtainMs: ms }));
  const hitShield = (side: "L" | "R", heavy: boolean) => {
    const id = fx("attack", side);
    window.setTimeout(() => {
      dropFx(id);
      if (heavy) sfx("impact"); else playBarrierImpact();
      set((current) => ({ ...current, shields: { ...current.shields, [side]: { ...current.shields[side], impact: current.shields[side].impact + 1, shake: current.shields[side].shake + 1 }, [side === "L" ? "R" : "L"]: { ...current.shields[side === "L" ? "R" : "L"], shake: current.shields[side === "L" ? "R" : "L"].shake + 1 } } }));
    }, 900);
  };
  const lightFlow = () => {
    const ids = [fx("beam", "L", U4_LAYOUT.defense.deneb), fx("beam", "L", U4_LAYOUT.defense.kaiden), fx("beam", "R", U4_LAYOUT.defense.kaf), fx("beam", "R", U4_LAYOUT.defense.luna)];
    set((current) => ({ ...current, shields: { L: { ...current.shields.L, pulse: current.shields.L.pulse + 1 }, R: { ...current.shields.R, pulse: current.shields.R.pulse + 1 } } }));
    window.setTimeout(() => ids.forEach(dropFx), 1000);
  };

  /* ------------------------------------------------------------ the defense start (also every skip into it) */
  const toDefenseStart = () => {
    stopVoice(); murmur.current?.stop(400); murmur.current = null; manseEnded.current = null;
    setStagePhase("map"); setCaption(null); setStory(null);
    place(defenseActors());
    set((current) => ({ ...current, shields: freshShields("hold"), fx: [], alarms: {}, shadows: [], curtain: false, curtainMs: 600, rifts: false, door: false, tint: false }));
    startBgm(U4_BGM.story);
    callbacks.current.onDefenseReady();
  };

  /* ------------------------------------------------------------ cues from story checkpoints */
  const onCue = (name: string) => {
    switch (name) {
      case "murmur-start": murmur.current = sfx("murmur", { loop: true, fadeInMs: 800 }); break;
      case "murmur-fade": murmur.current?.stop(2200); murmur.current = null; break;
      case "declaration-1": stopVoice(); voice.current = sfx("declaration1"); break;
      case "declaration-2": stopVoice(); voice.current = sfx("declaration2"); break;
      case "declaration-end": stopVoice(); break;
      case "manse": { const handle = sfx("manse"); manseEnded.current = handle.ended; break; }
      case "bgm-after-manse": {
        const ended = manseEnded.current;
        void (ended ?? Promise.resolve()).then(() => { if (!unmounted.current && manseEnded.current === ended) { manseEnded.current = null; startBgm(U4_BGM.story); } });
        break;
      }
      case "command-1": sfx("command1"); break;
      case "command-2": sfx("command2"); break;
      default: break;
    }
  };

  /* ------------------------------------------------------------ the script */
  const runIntro = async () => {
    // 탑골공원 (illustration stage + caption). Skip → the defense start.
    await runSection(true, async () => {
      setStagePhase("tapgol");
      curtain(false, 600); // the illustration stage is drawn by the StoryPlayer (dialogue layer), above the hidden map
      setCaption({ text: "1919년 3월 1일, 서울 탑골공원", holdMs: 0 });
      await say("tapgol");
      setCaption(null);
      // 아우내 장터 event map
      curtain(true, 0);
      setStagePhase("map");
      await Promise.all([wait(500), decodeImages(U4_IMAGE_URLS, 5000)]);
      const E = U4_LAYOUT.entrance;
      const entrance = [walkTo("kaiden", E.kaiden), walkTo("kaf", E.kaf), walkTo("deneb", E.deneb)];
      curtain(false, 900);
      await wait(400);
      setCaption({ text: "1919년 4월 1일, 천안 아우내 장터", holdMs: 2000 });
      await Promise.all(entrance);
      await wait(800);
      await say("crowd");
      alarm("deneb", "kaiden", "kaf");
      await wait(1800);
      await say("voice");
      patch("luna", { shown: true, fadeMs: 800 });
      await wait(900);
      await say("reunion");
      sfx("whistle");
      await wait(700);
      sfx("footsteps");
      await wait(900);
      await say("command");
      // 포위: exclamations, everyone glances left and right
      alarm("deneb", "kaiden", "kaf", "luna");
      for (const facing of ["L", "R", "L"] as const) {
        (["deneb", "kaiden", "kaf", "luna"] as const).forEach((id) => patch(id, { facing }));
        await wait(520);
      }
      await say("surrounded");
      // dialogue hidden: the four walk to their places (turn → walk), defense poses, both shields
      const P = U4_LAYOUT.defense;
      await Promise.all([walkTo("deneb", P.deneb), walkTo("kaiden", P.kaiden), walkTo("kaf", P.kaf), walkTo("luna", P.luna)]);
      patch("deneb", { pose: "denebDefense", facing: "L" }); patch("kaiden", { facing: "L" });
      patch("kaf", { pose: "kafDefense", facing: "R" }); patch("luna", { pose: "lunaDefense", facing: "R" });
      await wait(300);
      sounds.current.add(playBarrierSpawn());
      shields("spawn");
      await wait(1100);
      hitShield("L", false);
      await wait(300);
      hitShield("R", false);
      await wait(1300);
      await say("pressure");
    }, () => undefined);
    toDefenseStart();
  };

  const runDefenseStart = async () => {
    await runSection(false, async () => {
      setDefense(createFloor4Defense());
      await waitUi("guide");
      setBgmLevel(U4_BGM.defense, U4_BGM.rampMs, U4_BGM.id); // with the title, over ~1.5 s
      setUi("title");
      await wait(1900);
      setUi("question");
    }, () => undefined);
  };

  const resumeQuestions = () => { setBgmLevel(U4_BGM.defense, 800, U4_BGM.id); setUi("question"); };

  const runTalk3 = () => runSection(true, async () => {
    setUi("none");
    setBgmLevel(U4_BGM.talk, 600, U4_BGM.id);
    await wait(500);
    await say("talk3");
  }, () => undefined).then(resumeQuestions);

  const EVACUEES = ["elder", "student", "liaison"] as const;
  const runEvacuate6 = () => runSection(true, async () => {
    setUi("none");
    setBgmLevel(U4_BGM.talk, 600, U4_BGM.id);
    await wait(500);
    await say("evacuate6a");
    // 주민 일부 → the gate in the middle of the back row, then gone; the 연락책 follows.
    await Promise.all([walkTo("elder", U4_LAYOUT.exitX), walkTo("student", U4_LAYOUT.exitX)]);
    patch("elder", { shown: false, fadeMs: 700 }); patch("student", { shown: false, fadeMs: 700 });
    await walkTo("liaison", U4_LAYOUT.exitX);
    patch("liaison", { shown: false, fadeMs: 700 });
    await wait(700);
    await say("evacuate6b");
  }, () => {
    EVACUEES.forEach((id) => { at.current[id] = U4_LAYOUT.exitX; patch(id, { x: U4_LAYOUT.exitX, shown: false, walking: false, moveMs: 0, fadeMs: 0 }); });
  }).then(resumeQuestions);

  const toGameOver = () => {
    stopSounds(300);
    set((current) => ({ ...current, curtain: true, curtainMs: 500, shields: freshShields("none"), fx: [] }));
    void fadeOutBgm(1500, U4_BGM.id);
    setUi("gameover");
  };
  const runFail = () => runSection(true, async () => {
    setUi("none");
    // cracks on both shields → collapse sound → short shake + dark flash
    const cracks = [fx("crack", "L"), fx("crack", "R")];
    await wait(700);
    sfx("impact"); playBarrierImpact();
    set((current) => ({ ...current, quake: current.quake + 1, flash: current.flash + 1 }));
    shields("despawn");
    await wait(900);
    cracks.forEach(dropFx);
    // some people in the middle are now lying down, others crouch beside them (no injury shown, state not fixed)
    const shown = scene.actors;
    if (shown.male.shown) patch("male", { pose: "fallenMale" });
    if (shown.female2.shown) patch("female2", { pose: "fallenFemale" });
    if (shown.elder.shown) patch("elder", { pose: "crouch" });
    await wait(600);
    await say("fail");
    curtain(true, 900);
    await wait(1000);
  }, () => undefined).then(toGameOver);

  const finish = () => {
    stopSounds(300);
    void fadeOutBgm(1200, U4_BGM.id);
    callbacks.current.onCleared();
  };
  const runSuccess = () => runSection(!cleared, async () => {
    setUi("success");
    setBgmLevel(U4_BGM.story, 2000, U4_BGM.id);
    await wait(2600);
    setUi("none");
    if (cleared) { await wait(300); return; } // replay after the floor was cleared: no story again
    await say("success1");
    await walkTo("female2", U4_LAYOUT.exitX);
    patch("female2", { shown: false, fadeMs: 700 });
    await wait(500);
    await say("success2");
    // 거대한 힘 — the defense is already won; this collapse is the script's scene, not a judgement.
    await wait(1200); // attacks die down
    await say("quiet");
    sfx("rumble");
    set((current) => ({ ...current, rifts: true, quake: current.quake + 1 }));
    await wait(1200);
    await say("biggerForce");
    sfx("command1");
    await wait(900);
    const waves = [fx("shockwave", "L"), fx("shockwave", "R")];
    window.setTimeout(() => sfx("impact"), 700);
    await wait(1200);
    await say("brace");
    lightFlow();
    await wait(900);
    const cracks = [fx("crack", "L"), fx("crack", "R")];
    await wait(700);
    await say("getDown");
    sfx("impact");
    set((current) => ({ ...current, flash: current.flash + 1, quake: current.quake + 1 }));
    shields("despawn");
    await wait(700);
    [...waves, ...cracks].forEach(dropFx);
    // people lying down (appear with the flash), others helping each other toward the back alley
    patch("male", { pose: "fallenMale", facing: "L" });
    patch("fallenA", { shown: true, fadeMs: 300 });
    patch("pair", { shown: true, fadeMs: 600 });
    await wait(900);
    await say("afterCollapse");
    patch("pair", { x: U4_LAYOUT.fallen.pair + 90, moveMs: 1600, shown: false, fadeMs: 1600 });
    sfx("whistle");
    await wait(500);
    sfx("footsteps");
    await say("arrest");
    // shadows fall over 유관순 and the people near her; they are moved away to one side and are gone
    set((current) => ({ ...current, shadows: ["yu", "male"] }));
    await wait(1100);
    patch("male", { pose: "male", facing: "L" });
    await Promise.all([walkTo("yu", 760, true), walkTo("male", 600, true)]);
    patch("yu", { shown: false, fadeMs: 700 }); patch("male", { shown: false, fadeMs: 700 });
    set((current) => ({ ...current, shadows: [] }));
    await wait(600);
    await say("lunaWait");
    await walkTo("luna", U4_LAYOUT.defense.luna - 140);
    await walkTo("kaf", U4_LAYOUT.defense.luna - 140 - 175);
    await say("lunaStopped");
    curtain(true, 900);
    set((current) => ({ ...current, rifts: false }));
    await wait(1000);
    // 안전한 골목 (same market, evening light): the four + people being helped
    const A = U4_LAYOUT.alley, base = crowdScene();
    const alley: Record<ActorId, EventMapActorState> = Object.fromEntries((Object.keys(base) as ActorId[]).map((id) => [id, { ...base[id], shown: false, fadeMs: 0 }])) as Record<ActorId, EventMapActorState>;
    alley.pair = { ...alley.pair, x: A.pair, facing: "R", shown: true };
    alley.elder = { ...alley.elder, x: A.elder, facing: "R", shown: true };
    alley.luna = { ...alley.luna, pose: "luna", x: A.luna, facing: "R", shown: true };
    alley.deneb = { ...alley.deneb, pose: "deneb", x: A.deneb, facing: "L", shown: true };
    alley.kaf = { ...alley.kaf, pose: "kafAcademy", x: A.kaf, facing: "L", shown: true };
    alley.kaiden = { ...alley.kaiden, pose: "kaiden", x: A.kaiden, facing: "L", shown: true };
    place(alley);
    set((current) => ({ ...current, shields: freshShields("none"), fx: [], alarms: {}, tint: true }));
    await wait(400);
    curtain(false, 900);
    await wait(1000);
    await say("alley");
    // the glowing record door at the end of the alley; everyone looks at it
    set((current) => ({ ...current, door: true }));
    (["deneb", "kaf", "kaiden", "luna", "elder", "pair"] as const).forEach((id) => patch(id, { facing: "R" }));
    await wait(1800);
    curtain(true, 900);
    await wait(1000);
    // 대한민국 임시정부 (illustration only; no expedition members)
    setStagePhase("shanghai");
    curtain(false, 900);
    setCaption({ text: "1919년 4월, 중국 상하이", holdMs: 2000 });
    await say("shanghai");
    setCaption(null);
    // 루나의 선택 — in front of the record door
    const D = U4_LAYOUT.door;
    const door: Record<ActorId, EventMapActorState> = Object.fromEntries((Object.keys(alley) as ActorId[]).map((id) => [id, { ...alley[id], shown: false }])) as Record<ActorId, EventMapActorState>;
    door.luna = { ...alley.luna, x: D.luna, facing: "R", shown: true };
    door.deneb = { ...alley.deneb, x: D.deneb, facing: "L", shown: true };
    door.kaf = { ...alley.kaf, x: D.kaf, facing: "L", shown: true };
    door.kaiden = { ...alley.kaiden, x: D.kaiden, facing: "L", shown: true };
    curtain(true, 600);
    await wait(700);
    place(door);
    setStagePhase("map");
    await wait(400);
    curtain(false, 900);
    await wait(1000);
    await say("choice");
    curtain(true, 900);
    await wait(1000);
  }, () => undefined).then(finish);

  /* ------------------------------------------------------------ questions */
  const questionIndex = defense.processed;
  const handleReview = (questionId: string, correct: boolean) => {
    const before = defenseRef.current;
    const next = applyFloor4Answer(before, questionIndex, correct);
    if (next === before) return; // double submit / already answered
    defenseRef.current = next;
    setDefense(next);
    if (correct) { callbacks.current.onQuestionCorrect(questionId); lightFlow(); }
    else hitShield(Math.random() < 0.5 ? "L" : "R", isFloor4FinalStretch(next));
  };
  const handleProcessed = () => {
    const { state, event } = processFloor4Question(defenseRef.current, questionIndex);
    if (state === defenseRef.current) return;
    defenseRef.current = state;
    setDefense(state);
    if (event === "fail") void runFail();
    else if (event === "success") void runSuccess();
    else if (event === "talk3") void runTalk3();
    else if (event === "evacuate6") void runEvacuate6();
  };

  const retry = () => {
    stopSounds(100);
    setQuestions(drawUnit3Floor4Questions());
    setAttempt((value) => value + 1);
    const fresh = createFloor4Defense();
    defenseRef.current = fresh;
    setDefense(fresh);
    setUi("none");
    toDefenseStart();
    void runDefenseStart();
  };

  /* ------------------------------------------------------------ lifecycle */
  useEffect(() => {
    unmounted.current = false;
    (window as unknown as { __u3f4Bgm?: unknown }).__u3f4Bgm = getBgmDebugState;
    Object.values(U4_SFX).forEach((url) => void preloadUnit3SfxFile(url));
    const start = async () => {
      if (defenseReady || cleared) {
        await decodeImages(U4_IMAGE_URLS, 5000);
        toDefenseStart();
      } else {
        await runIntro();
      }
      await runDefenseStart();
    };
    start().catch((error) => { if (!(error instanceof Cancelled)) console.error(error); });
    return () => {
      unmounted.current = true;
      cancelSection(false);
      stopSounds(150);
      delete (window as unknown as { __u3f4Bgm?: unknown }).__u3f4Bgm;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------------------ render */
  const L = U4_LAYOUT;
  const shieldLevel = defense.shield;
  const shieldScale = 0.74 + 0.26 * (shieldLevel / UNIT3_FLOOR4_DEFENSE.max);
  const shieldOpacity = 0.62 + 0.38 * (shieldLevel / UNIT3_FLOOR4_DEFENSE.max);
  const renderShield = (side: "L" | "R") => {
    const s = scene.shields[side];
    if (s.phase === "none") return null;
    const S = BARRIER.scale;
    const left = side === "L" ? L.shieldLeft - BARRIER.bottomEndX * S : L.shieldRight - (BARRIER.w - BARRIER.bottomEndX) * S;
    const originX = side === "L" ? BARRIER.bottomEndX * S : (BARRIER.w - BARRIER.bottomEndX) * S;
    const sprite = (src: string, cols: number, rows: number, frames: number, fps: number, loop: boolean, key?: string, onEnd?: () => void) => (
      <GridSprite key={key} src={src} cols={cols} rows={rows} frames={frames} fps={fps} frameW={BARRIER.w} frameH={BARRIER.h} scale={S} loop={loop} onEnd={onEnd} />
    );
    return (
      <div key={side} className={`u4-shield is-${side === "L" ? "left" : "right"}`} data-phase={s.phase} data-testid={`u4-shield-${side}`}
        style={{ left, top: shieldTop, width: BARRIER.w * S, height: BARRIER.h * S, transformOrigin: `${originX}px ${BARRIER.bottomEndY * S}px`,
          transform: `scale(${s.phase === "hold" ? shieldScale : 1})`, opacity: s.phase === "hold" ? shieldOpacity : 1 }}>
        <div key={`shake-${s.shake}`} className={`u4-shield-body ${s.shake ? "is-shaking" : ""}`}>
          <div key={`pulse-${s.pulse}`} className={`u4-shield-flip ${s.pulse ? "is-pulsing" : ""}`} style={{ transform: side === "R" ? "scaleX(-1)" : undefined }}>
            {s.phase === "spawn" && sprite(U3EM_IMAGES.barrierSpawn, 4, 3, 12, 16, false, "spawn", () => set((current) => current.shields[side].phase === "spawn" ? { ...current, shields: { ...current.shields, [side]: { ...current.shields[side], phase: "hold" } } } : current))}
            {s.phase === "hold" && sprite(U3EM_IMAGES.barrierHold, 4, 4, 16, 8, true, "hold")}
            {s.phase === "hold" && s.impact > 0 && sprite(U3EM_IMAGES.barrierImpact, 5, 2, 10, 16, false, `impact-${s.impact}`)}
            {s.phase === "despawn" && <div className="u3em-despawn">{sprite(U3EM_IMAGES.barrierDespawn, 4, 3, 12, 16, false, "despawn")}</div>}
          </div>
        </div>
      </div>
    );
  };
  const renderFx = (item: Fx) => {
    const apex = shieldApex(item.side);
    const mirror = item.side === "R";
    if (item.kind === "attack") {
      const s = 1.5, w = 208 * s;
      const left = mirror ? apex - (208 - 136) * s - 6 : apex - 136 * s + 6;
      return <div key={item.id} className="u4-fx" style={{ left, top: contactY - 78 * s, width: w, transform: mirror ? "scaleX(-1)" : undefined }}>
        <GridSprite src={U4_IMAGES.attack} cols={6} rows={5} frames={29} fps={15} frameW={208} frameH={112} scale={s} loop={false} /></div>;
    }
    if (item.kind === "beam") {
      const startX = item.from ?? 0, y = G - 150, tip = mirror ? apex - 30 : apex + 30;
      const k = (tip - startX) / 186;
      return <div key={item.id} className="u4-fx u4-beam" style={{ left: startX - 26, top: y - 84, transformOrigin: "26px 84px", transform: `scaleX(${k})` }}>
        <GridSprite src={U4_IMAGES.lightFlow} cols={6} rows={3} frames={18} fps={15} frameW={264} frameH={100} scale={1} loop /></div>;
    }
    if (item.kind === "shockwave") {
      const s = 1.5, cx = mirror ? apex - 40 : apex + 40;
      return <div key={item.id} className="u4-fx" style={{ left: cx - 140 * s, top: contactY - 40 - 152 * s }}>
        <GridSprite src={U4_IMAGES.shockwave} cols={8} rows={8} frames={58} fps={15} frameW={280} frameH={248} scale={s} loop={false} /></div>;
    }
    const s = 2.2, cx = mirror ? apex - 45 : apex + 45;
    return <div key={item.id} className="u4-fx" style={{ left: cx - 66 * s, top: contactY - 30 - 76 * s }}>
      <GridSprite src={U4_IMAGES.crack} cols={8} rows={6} frames={43} fps={15} frameW={224} frameH={112} scale={s} loop={false} /></div>;
  };
  const actors = useMemo(() => Object.entries(scene.actors) as [ActorId, EventMapActorState][], [scene.actors]);
  const showQuestion = ui === "question" && questionIndex < UNIT3_FLOOR4_DEFENSE.total;

  return (
    <div ref={rootRef} className={`u3em-root is-entered u4-root ${scene.tint ? "is-evening" : ""}`} data-testid="u4-screen" data-ui={ui}
      data-stage={stagePhase} data-shield={defense.shield} data-processed={defense.processed} data-story={story?.key ?? ""} data-attempt={attempt}>
      <div className="u3em-camera u4-camera" style={{ transform: `translate3d(${-cameraX * scale}px,${sceneTop}px,0) scale(${scale})`, transitionDuration: "700ms" }}>
        <div key={`quake-${scene.quake}`} className={`u3em-scene ${scene.quake ? "u4-quake" : ""}`} style={{ width: U3EM_SCENE.width, height: U3EM_SCENE.height }}>
          <img className="u3em-layer u3em-bg" src={U4_IMAGES.background} alt="" draggable={false} />
          {scene.rifts && [140, 2030].map((x) => (
            <div key={x} className="u4-fx u4-rift" style={{ left: x - 80 * 1.6, top: 250 - 72 * 1.6 }}>
              <GridSprite src={U4_IMAGES.rift} cols={10} rows={6} frames={60} fps={15} frameW={160} frameH={144} scale={1.6} loop /></div>
          ))}
          <img className="u3em-layer u3em-wall" src={U4_IMAGES.wall} alt="" draggable={false} />
          <img className="u3em-layer u3em-ground" src={U4_IMAGES.ground} alt="" draggable={false} />
          {scene.door && <div className="u4-fx u4-door" style={{ left: L.door.x - 76 * 2.2, top: G - 106 * 2.2 }}>
            <GridSprite src={U4_IMAGES.recordDoor} cols={6} rows={6} frames={36} fps={15} frameW={152} frameH={116} scale={2.2} loop /></div>}
          {actors.map(([id, a]) => (
            <EventMapActor key={id} id={id} actor={a} pose={U4_POSES[a.pose]} groundY={G} phaseMs={(a.z * 137) % 560}>
              {scene.alarms[id] ? <GridSprite key={scene.alarms[id]} className="u3em-exclamation" src={U3EM_IMAGES.exclamation} cols={12} rows={1} frames={12} fps={7} frameW={60} frameH={60} scale={1.5}
                loop={false} style={{ top: -84 }} /> : null}
              {scene.shadows.includes(id) && <div className="u4-shadow" />}
            </EventMapActor>
          ))}
          {renderShield("L")}
          {renderShield("R")}
          {scene.fx.map(renderFx)}
        </div>
      </div>
      {scene.tint && <div className="u4-evening" />}
      <div key={`flash-${scene.flash}`} className={`u4-flash ${scene.flash ? "is-on" : ""}`} />
      <div className="story-player story-player-baseCampOverlay u3em-probe" aria-hidden="true"><div ref={probeRef} className="story-dialogue-box" /></div>
      <div className={`u3em-curtain ${scene.curtain ? "is-closed" : ""}`} style={{ transitionDuration: `${scene.curtainMs}ms` }} />
      <Unit3Floor4Caption text={caption?.text ?? null} holdMs={caption?.holdMs ?? 0} />

      {(ui === "question" || ui === "title" || ui === "guide") && (
        <div className="u4-hud" role="status" aria-label="보호막 상태" data-testid="u4-hud">
          <span className="u4-hud-label">보호막의 힘</span>
          <span className="u4-hud-gauge" aria-hidden="true"><span style={{ width: `${shieldLevel}%` }} /></span>
          <strong>{shieldLevel} / {UNIT3_FLOOR4_DEFENSE.max}</strong>
          <span className="u4-hud-count">처리 문항 {defense.processed} / {UNIT3_FLOOR4_DEFENSE.total}</span>
        </div>
      )}
      {showQuestion && questions[questionIndex] && (
        <section className="dungeon-room-event-panel is-question u4-question-panel" aria-label="방어전 문제">
          <QuestionScreen key={`${attempt}-${questionIndex}`} embedded eyebrow={`QUESTION ${questionIndex + 1} / ${UNIT3_FLOOR4_DEFENSE.total}`}
            questions={[questions[questionIndex]]} instanceSeed={`u3f4-${attempt}-${questionIndex}`} onNavigate={() => undefined}
            onReviewChange={(result) => handleReview(result.questionId, result.isCorrect)}
            onResult={(result) => { handleReview(result.questionId, result.isCorrect); handleProcessed(); }} />
        </section>
      )}
      {ui === "guide" && (
        <div className="pixel-popup-backdrop u4-guide">
          <section className="pixel-rpg-popup" role="dialog" aria-modal="true" aria-labelledby="u4-guide-title">
            <header><p className="eyebrow">3·1 운동 방어전</p><h2 id="u4-guide-title">보호막을 지켜 주세요</h2></header>
            <p className="u4-guide-text">12문항 동안 보호막을 유지해 주세요.<br />정답이면 보호막이 커지고, 오답이면 작아집니다.<br />보호막이 사라지면 방어에 실패합니다.</p>
            <div className="quest-reward-actions"><button type="button" onClick={() => uiDone.current?.()}>확인</button></div>
          </section>
        </div>
      )}
      {ui === "title" && <div className="u4-title" aria-live="polite">3·1 운동 방어전</div>}
      {ui === "success" && <div className="u4-banner" role="status">방어 성공 — 사람들이 피할 시간을 확보했습니다.</div>}
      {ui === "gameover" && (
        <PlayerDefeatedOverlay busy={false} className="u4-gameover" eyebrow="GAME OVER" title="게임 오버"
          message={<>보호막이 너무 일찍 무너졌습니다.<br />다시 도전해 사람들이 피할 시간을 확보해 주세요.</>}
          returnLabel="베이스캠프로 돌아가기" onRetry={retry} onReturnToBaseCamp={() => { stopSounds(100); callbacks.current.onReturnToCamp(); }} />
      )}

      {story && (
        <div className="u3em-dialogue u4-dialogue">
          <StoryPlayer key={story.key} sequence={story.sequence} playerName={playerName} playerStatus={playerStatus}
            presentationMode="baseCampOverlay" onNavigate={onNavigate}
            stageRenderers={{ [UNIT3_FLOOR4_STAGE_ID]: (phase) => (story.key === "tapgol" || story.key === "shanghai") ? <Unit3Floor4Stage phase={phase} /> : null }}
            onCheckpointReached={(_, checkpointId) => { if (checkpointId.startsWith("u3f4:")) onCue(checkpointId.slice(5)); }}
            onComplete={() => storyDone.current?.()} />
        </div>
      )}
      {skippable && <button type="button" className="story-dialogue-skip-button u3em-skip" onClick={() => skipRef.current?.()}>건너뛰기</button>}
    </div>
  );
}
