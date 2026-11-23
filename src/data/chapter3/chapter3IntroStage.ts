import type { Chapter3ActorId, Facing } from "./chapter3Actors";

/**
 * Declarative stage states for the Unit 3 intro. A story step `setStagePhase { stageId: "chapter3-intro" }`
 * selects one of these; Chapter3IntroStage renders it. Map coordinates are 1672x941 map px; actor x is the feet.
 */
export type StageActorState = {
  id: Chapter3ActorId;
  x: number;
  facing: Facing;
  enter?: "fade" | "warp";
  walking?: boolean;
  moveMs?: number;
  exclaim?: boolean;
  circle?: boolean;
};

export type StageAudioCue =
  | "bgm-hq"
  | "bgm-tension"
  | "warp-start"
  | "warp-distort"
  | "wind-start";

export type StagePhase = {
  map: "hq" | "arrival";
  actors: StageActorState[];
  camera: { x: number; y: number; zoom: number; durationMs?: number };
  /** darken the map (illustration / recap overlays sit above it) */
  dim?: boolean;
  /** 0 none, 1 charging, 2 peak */
  warp?: 0 | 1 | 2;
  flash?: boolean;
  /** arrival: ground + foreground + actors slide down off screen (background, sky stay) */
  drop?: boolean;
  audio?: StageAudioCue[];
};

export const STAGE_FOOT_Y = { hq: 800, arrival: 744 } as const;

/** Holo globe: pivot (globe centre) above the centre of the HQ command table (table top ≈ y720, centre x≈800). */
export const HQ_GLOBE = { x: 800, y: 626, scale: 1 } as const;

/** Sky crack drawn over the arrival sky (the arrival layers have no crack of their own). */
export const ARRIVAL_SKY_CRACK = { x: 1320, y: 160, width: 400, height: 256 } as const;

const HQ_CAMERA = { x: 700, y: 520, zoom: 1 } as const;
const ARRIVAL_HOME = { x: 660, y: 600, zoom: 1.6 } as const;

const four = (exclaim = false): StageActorState[] => [
  { id: "theo", x: 190, facing: "R", exclaim },
  { id: "luna", x: 290, facing: "R", exclaim },
  { id: "aron", x: 390, facing: "R", exclaim },
  { id: "kapp", x: 490, facing: "R", exclaim },
];
const player: StageActorState = { id: "player", x: 960, facing: "L" };
const commanders: StageActorState[] = [
  { id: "deneb", x: 590, facing: "L", enter: "fade" },
  { id: "kaiden", x: 690, facing: "R", enter: "fade" },
];
const researcher: StageActorState = { id: "researcher", x: 1230, facing: "L", enter: "fade" };
const withCircle = (actors: StageActorState[]) => actors.map((actor) => actor.id === "researcher" ? actor : { ...actor, circle: true });
const hqFull = [...four(), ...commanders, player, researcher];

const arrivalPlayer: StageActorState = { id: "player", x: 760, facing: "L" };
const arrivalKaiden: StageActorState = { id: "kaiden", x: 560, facing: "R", enter: "warp" };
const arrivalDeneb: StageActorState = { id: "deneb", x: 660, facing: "L", enter: "warp" };

export const CHAPTER3_INTRO_PHASES: Record<string, StagePhase> = {
  "hq-gather": { map: "hq", actors: [...four(), player], camera: HQ_CAMERA, audio: ["bgm-hq"] },
  "hq-exclaim": { map: "hq", actors: [...four(true), player], camera: HQ_CAMERA },
  "hq-commanders": { map: "hq", actors: [...four(), ...commanders, player], camera: HQ_CAMERA },
  "hq-researcher": { map: "hq", actors: hqFull, camera: HQ_CAMERA, audio: ["bgm-tension"] },
  "hq-portal-dim": { map: "hq", actors: hqFull, camera: HQ_CAMERA, dim: true },
  "hq-briefing": { map: "hq", actors: hqFull, camera: HQ_CAMERA },
  "hq-warp-charge": { map: "hq", actors: withCircle(hqFull), camera: HQ_CAMERA, warp: 1, audio: ["warp-start"] },
  "hq-warp-peak": { map: "hq", actors: withCircle(hqFull), camera: HQ_CAMERA, warp: 2 },
  "hq-warp-flash": { map: "hq", actors: withCircle(hqFull), camera: HQ_CAMERA, warp: 2, flash: true, audio: ["warp-distort"] },
  // Recap: base HQ state (same actors) with the dim on; the recap illustrations are StoryPlayer overlays.
  "hq-recap-dim": { map: "hq", actors: [...four(), player], camera: HQ_CAMERA, dim: true },
  "hq-recap-end": { map: "hq", actors: [...four(), player], camera: HQ_CAMERA },

  "arrival-player": { map: "arrival", actors: [arrivalPlayer], camera: ARRIVAL_HOME, audio: ["wind-start"] },
  "arrival-kaiden": { map: "arrival", actors: [arrivalKaiden, arrivalPlayer], camera: ARRIVAL_HOME },
  "arrival-kaiden-look-left": { map: "arrival", actors: [{ ...arrivalKaiden, facing: "L" }, arrivalPlayer], camera: ARRIVAL_HOME },
  "arrival-kaiden-look-right": { map: "arrival", actors: [{ ...arrivalKaiden, facing: "R" }, arrivalPlayer], camera: ARRIVAL_HOME },
  "arrival-deneb": { map: "arrival", actors: [arrivalKaiden, arrivalDeneb, arrivalPlayer], camera: ARRIVAL_HOME },
  "arrival-look-behind": { map: "arrival", actors: [arrivalKaiden, arrivalDeneb, arrivalPlayer], camera: { x: 380, y: 560, zoom: 1.6, durationMs: 2400 } },
  "arrival-look-return": { map: "arrival", actors: [arrivalKaiden, arrivalDeneb, arrivalPlayer], camera: { ...ARRIVAL_HOME, durationMs: 2000 } },
  "arrival-survey": { map: "arrival", actors: [arrivalKaiden, arrivalDeneb, arrivalPlayer], camera: { x: 1500, y: 420, zoom: 1.3, durationMs: 4200 } },
  "arrival-survey-return": { map: "arrival", actors: [arrivalKaiden, arrivalDeneb, arrivalPlayer], camera: { ...ARRIVAL_HOME, durationMs: 3000 } },
  "arrival-scout-out": { map: "arrival", actors: [{ ...arrivalKaiden, x: 1020, facing: "R", walking: true, moveMs: 2400 }, arrivalDeneb, arrivalPlayer], camera: ARRIVAL_HOME },
  "arrival-scout-pause": { map: "arrival", actors: [{ ...arrivalKaiden, x: 1020, facing: "R" }, arrivalDeneb, arrivalPlayer], camera: ARRIVAL_HOME },
  "arrival-scout-back": { map: "arrival", actors: [{ ...arrivalKaiden, x: 560, facing: "L", walking: true, moveMs: 2400 }, arrivalDeneb, arrivalPlayer], camera: ARRIVAL_HOME },
  "arrival-regroup": { map: "arrival", actors: [arrivalKaiden, arrivalDeneb, arrivalPlayer], camera: ARRIVAL_HOME },
  "arrival-drop": { map: "arrival", actors: [arrivalKaiden, arrivalDeneb, arrivalPlayer], camera: ARRIVAL_HOME, drop: true },
};

export const ARRIVAL_DROP_MS = 3600;
