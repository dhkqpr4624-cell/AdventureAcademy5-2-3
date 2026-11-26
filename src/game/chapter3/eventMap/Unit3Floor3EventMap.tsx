import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StoryPlayer } from "../../story/StoryPlayer";
import type { StorySequence } from "../../../types/story";
import { UNIT3_FLOOR3_EVENT_MAP_SEGMENTS } from "../../../data/chapter3/floor3Stories";
import { CHAPTER3_STAGE_SPRITES } from "../../../data/chapter3/chapter3Actors";
import { playBarrierImpact, playBarrierSpawn, preloadBarrierSpawn, startFogRumble, type Chapter3SfxHandle } from "../../audio/chapter3ProceduralSfx";
import { GridSprite } from "./GridSprite";
import lunaStanding from "../../../assets/story/npcs/chapter2/luna/standing_R.png";
import theoStanding from "../../../assets/story/npcs/chapter2/theo/standing_R.png";
import kappStandingR from "../../../assets/story/npcs/chapter2/kapp/standing_R.png";
import aronStanding from "../../../assets/story/npcs/chapter2/aron/standing_R.png";

/**
 * Phase 4 · Unit 3 Floor 3 final room — the side-scrolling evacuation event map (scripted cutscene; no combat,
 * no quiz, no damage). A small reusable scene structure, not an engine:
 *
 * - scene / layers: one 2172×724 scene coordinate system (the supplied layers' pixel size). Layer order:
 *   background (sky, city) → "foreground" wall/houses (drawn behind the people despite its file name) → ground →
 *   black fog → people + barrier → exclamation marks → dialogue (StoryPlayer overlay, outside the scene).
 *   The scene is scaled so it covers the width and takes ~74% of the viewport height, so feet always stay above
 *   the dialogue box; the camera is a translateX in scene units, clamped to the scene.
 * - actors: id, image (+ natural facing; mirrored with scaleX when facing the other way), x on the ground line,
 *   visible height, opacity. Moves are CSS `left` transitions, fades are opacity transitions, facing is a flip —
 *   React state changes only at cues (never per frame).
 * - cues (the async script below): move, face, image swap, show/hide (fade), camera, fog, barrier phase, SFX,
 *   dialogue segment, dim + flashback overlay, wait, screen fade. Every wait is cancellable (skip / unmount).
 * - sprite VFX: GridSprite (rAF background-position) for the fog loop, barrier spawn/hold/impact/despawn and the
 *   reused Chapter 2 exclamation sheet. `paused` freezes fog/barrier frames and the impact loop (flashback).
 * - skip: ends immediately; the caller saves the same state as a full play (flags, 카프 joined, quest state).
 * - cleanup: rumble stopped, timers cancelled and every sprite unmounted when the map ends or unmounts.
 */

const BASE = import.meta.env.BASE_URL;
const F3 = `${BASE}assets/chapter3/floor3/`;
export const U3EM_SCENE = { width: 2172, height: 724, groundY: 688, viewportShare: 0.74 } as const;

export const U3EM_IMAGES = {
  background: `${F3}eventmap/background.png`,
  wall: `${F3}eventmap/foreground.png`,
  ground: `${F3}eventmap/ground.png`,
  fog: `${F3}vfx/black-fog-loop-16f.png`,
  barrierSpawn: `${F3}vfx/barrier-spawn-12f.png`,
  barrierHold: `${F3}vfx/barrier-hold-loop-16f.png`,
  barrierImpact: `${F3}vfx/barrier-impact-10f.png`,
  barrierDespawn: `${F3}vfx/barrier-despawn-12f.png`,
  /** Phase 4 hotfix 2: PixelFX `holy/memory-awakening` (8×5 grid, 37 frames, 15 fps, one-shot; peak = frame 15). */
  memoryAwakening: `${F3}vfx/kaf-memory-awakening.png`,
  exclamation: `${BASE}assets/story/chapter2/intro/exclamation-sheet.png`,
  prisonBackground: `${BASE}assets/dungeon7/prison-background.png`,
  prisonForeground: `${BASE}assets/dungeon7/prison-foreground.png`,
  prisonGround: `${BASE}assets/dungeon7/prison-ground.png`,
  prisonCaptive: `${BASE}assets/dungeon7/captive-deneb.png`,
} as const;

/**
 * Image + measured alpha box (alpha > 128: top/bottom rows, left/right columns) + natural facing. The visible
 * box (not the PNG canvas) is what the scripted layout spaces out, and `x` is the centre of that box.
 */
type Pose = { src: string; w: number; h: number; top: number; bottom: number; left: number; right: number; natural: "L" | "R"; visibleH: number };
export const U3EM_POSES = {
  deneb: { src: `${BASE}assets/npcs/chapter2/deneb/standing_R.png`, w: 400, h: 700, top: 38, bottom: 682, left: 1, right: 398, natural: "R", visibleH: 236 },
  denebDefense: { src: `${F3}standing/deneb-defense-R.png`, w: 948, h: 1659, top: 133, bottom: 1462, left: 49, right: 895, natural: "R", visibleH: 268 },
  kaiden: { src: CHAPTER3_STAGE_SPRITES.kaiden.images.L!, w: 600, h: 700, top: 23, bottom: 671, left: 122, right: 495, natural: "L", visibleH: 250 },
  // Hotfix: 카프 keeps her original Adventure Academy outfit for the whole event map (standing + defense pose).
  // Hotfix 2: before her memory returns 카프 wears the 개화기 costume (supplied standing + defense pose). Their
  // visibleH keeps the element exactly the size of the academy pose it swaps with (same canvas scale and feet),
  // so the outfit change never moves her feet, centre or size.
  kafPeriod: { src: `${F3}standing/kaf-period-standing.png`, w: 400, h: 700, top: 110, bottom: 686, left: 28, right: 390, natural: "R", visibleH: 232.9 },
  kafPeriodDefense: { src: `${F3}standing/kaf-period-defense-R.png`, w: 948, h: 1659, top: 256, bottom: 1461, left: 46, right: 910, natural: "R", visibleH: 237.3 },
  kafDefense: { src: `${F3}standing/kaf-defense-R.png`, w: 948, h: 1659, top: 283, bottom: 1461, left: 32, right: 918, natural: "R", visibleH: 232 },
  kafAcademy: { src: kappStandingR, w: 400, h: 700, top: 132, bottom: 681, left: 32, right: 379, natural: "R", visibleH: 222 },
  student: { src: `${F3}standing/student.png`, w: 255, h: 383, top: 4, bottom: 380, left: 18, right: 239, natural: "R", visibleH: 176 },
  official: { src: `${F3}standing/school-official.png`, w: 341, h: 512, top: 5, bottom: 509, left: 11, right: 315, natural: "R", visibleH: 240 },
  resident1: { src: `${F3}standing/resident1.png`, w: 154, h: 247, top: 4, bottom: 242, left: 10, right: 134, natural: "R", visibleH: 214 },
  resident2: { src: `${F3}standing/resident2.png`, w: 299, h: 327, top: 2, bottom: 324, left: 58, right: 208, natural: "R", visibleH: 222 },
} satisfies Record<string, Pose>;
type PoseId = keyof typeof U3EM_POSES;
/** Visible width of a pose in scene units. */
export const poseVisibleWidth = (id: PoseId) => { const p: Pose = U3EM_POSES[id]; return (p.right - p.left) * p.visibleH / (p.bottom - p.top); };
/** Walking speed (scene units / s): one pace for every walk, a faster one for the hurried exits. */
export const U3EM_WALK_SPEED = 150;
export const U3EM_HURRY_SPEED = 260;

export const U3EM_IMAGE_URLS: string[] = [
  ...Object.values(U3EM_IMAGES), ...Object.values(U3EM_POSES).map((pose) => pose.src),
  lunaStanding, theoStanding, kappStandingR, aronStanding,
];

type ActorId = "deneb" | "kaf" | "kaiden" | "student" | "official" | "resident1" | "resident2";
type Actor = { pose: PoseId; x: number; facing: "L" | "R"; shown: boolean; moveMs: number; fadeMs: number; z: number; alarm: number; walking: boolean; pace: "walk" | "hurry" };
type Scene = {
  actors: Record<ActorId, Actor>;
  cameraFocus: number; cameraMs: number;
  /** x of the fog's front edge (scene units) and its move duration. */
  fog: { shown: boolean; front: number; moveMs: number; fadeMs: number };
  barrier: "none" | "spawn" | "hold" | "despawn";
  impact: number; dim: boolean; flashback: boolean; curtain: boolean; curtainMs: number;
  /** Hotfix 2: dialogue in the memory-flashback style; memory-recovery light (count = replays, 0 = none). */
  memoryStyle: boolean; awaken: number; awakenOn: boolean;
};

/** Layout (scene units). Barrier: bottom end on the ground at BARRIER_X; the fog stops at its apex. */
export const U3EM_LAYOUT = {
  barrierX: 410, barrierScale: 1.36, fogScale: 2.6,
  barrierFrame: { w: 128, h: 256, apex: [40, 128] as const, bottomEnd: [86, 240] as const, contact: [41, 150] as const },
  /** frontX: the point of the fog body that presses on the barrier (the thin wisp tail beyond it stays behind the barrier). */
  fogFrame: { w: 384, h: 128, leftAnchorX: 8, bottomY: 119, frontX: 350 },
  // Spaced by visible width + ~25 units (see poseVisibleWidth); feet stay on GROUND_Y.
  defenders: { deneb: 520, kaf: 715 },
  kaidenWait: 1760,
  /** Entrance targets, left → right: 데네브 (last) → 카프 → 주민·학생·학교 관계자 → 카이든 (leading). */
  entrance: { deneb: 640, kaf: 807, resident1: 958, resident2: 1090, student: 1218, official: 1366, kaiden: 1536 },
  entranceDistance: 1100,
  /** Safe alley: all seven people from the evacuation. */
  safeAlley: { deneb: 700, kaf: 867, kaiden: 1034, student: 1182, official: 1330, resident1: 1483, resident2: 1615 },
} as const;
const barrierApexX = U3EM_LAYOUT.barrierX - (U3EM_LAYOUT.barrierFrame.bottomEnd[0] - U3EM_LAYOUT.barrierFrame.apex[0]) * U3EM_LAYOUT.barrierScale;
/** Memory-recovery VFX timing (from kaf-memory-awakening.json: 37 frames at 15 fps, peak frame 15) and size. */
export const U3EM_MEMORY_VFX = { cols: 8, rows: 5, frames: 37, fps: 15, frameW: 112, frameH: 176, pivotX: 56, pivotY: 166, scale: 1.7, peakFrame: 15, peakMs: 1000, durationMs: 2467 } as const;
export const U3EM_FOG_CONTACT_FRONT = Math.round(barrierApexX + 6);

const actor = (pose: PoseId, x: number, facing: "L" | "R", z: number, shown = true): Actor => ({ pose, x, facing, shown, moveMs: 0, fadeMs: 600, z, alarm: 0, walking: false, pace: "walk" });
const E = U3EM_LAYOUT.entrance;
const D = U3EM_LAYOUT.entranceDistance;
const initialScene = (): Scene => ({
  actors: {
    deneb: actor("deneb", E.deneb - D, "R", 3), kaf: actor("kafPeriod", E.kaf - D, "R", 4),
    resident1: actor("resident1", E.resident1 - D, "R", 5), resident2: actor("resident2", E.resident2 - D, "R", 6),
    student: actor("student", E.student - D, "R", 7), official: actor("official", E.official - D, "R", 8),
    kaiden: actor("kaiden", E.kaiden - D, "R", 9),
  },
  cameraFocus: 1050, cameraMs: 0,
  fog: { shown: false, front: -120, moveMs: 0, fadeMs: 600 },
  barrier: "none", impact: 0, dim: false, flashback: false, curtain: false, curtainMs: 0, memoryStyle: false, awaken: 0, awakenOn: false,
});

class Cancelled extends Error {}
type SegmentKey = keyof typeof UNIT3_FLOOR3_EVENT_MAP_SEGMENTS;

function decodeAll(urls: readonly string[], timeoutMs: number): Promise<void> {
  const each = urls.map((url) => new Promise<void>((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => { void image.decode?.().catch(() => undefined).finally(() => resolve()); if (!image.decode) resolve(); };
    image.onerror = () => resolve();
    image.src = url;
  }));
  return Promise.race([Promise.all(each).then(() => undefined), new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs))]);
}

export function Unit3Floor3EventMap({ playerName, playerStatus, onComplete }: {
  playerName: string;
  playerStatus: React.ComponentProps<typeof StoryPlayer>["playerStatus"];
  /** Called once, after the final fade (or on skip). The caller saves flags / 카프 joined and returns to camp. */
  onComplete: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ w: 1280, h: 720, boxTop: 517 });
  const [scene, setScene] = useState<Scene>(initialScene);
  const [segment, setSegment] = useState<{ key: SegmentKey; sequence: StorySequence } | null>(null);
  const [entered, setEntered] = useState(false);
  const segmentDone = useRef<(() => void) | null>(null);
  const timers = useRef(new Set<number>());
  const cancelledRef = useRef(false);
  const doneRef = useRef(false);
  const rumble = useRef<Chapter3SfxHandle | null>(null);
  const barrierSfx = useRef<Chapter3SfxHandle | null>(null);
  const awakenCue = useRef<((cue: "peak" | "end") => void) | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Viewport measurement (state changes only on resize).
  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    // The probe has the dialogue box's own class, so its top follows the same responsive CSS (min-height rules).
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

  // Feet (ground line) always sit above the dialogue box; the scene covers the width. On short screens the top of
  // the sky is cropped (sceneTop < 0) instead of letting the dialogue box cover anyone's feet.
  const safeFeetY = Math.max(60, viewport.boxTop - 10);
  const scale = Math.max(viewport.w / U3EM_SCENE.width, Math.min((viewport.h * U3EM_SCENE.viewportShare) / U3EM_SCENE.height, safeFeetY / U3EM_SCENE.groundY));
  const sceneTop = Math.min(0, safeFeetY - U3EM_SCENE.groundY * scale);
  const visibleW = viewport.w / scale;
  const cameraX = Math.max(0, Math.min(U3EM_SCENE.width - visibleW, scene.cameraFocus - visibleW / 2));

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    cancelledRef.current = true;
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current.clear();
    rumble.current?.stop(400);
    rumble.current = null;
    barrierSfx.current?.stop(150);
    barrierSfx.current = null;
    segmentDone.current = null;
    onCompleteRef.current();
  }, []);

  // The cue script.
  useEffect(() => {
    cancelledRef.current = false;
    const wait = (ms: number) => new Promise<void>((resolve, reject) => {
      if (cancelledRef.current) { reject(new Cancelled()); return; }
      const id = window.setTimeout(() => { timers.current.delete(id); if (cancelledRef.current) reject(new Cancelled()); else resolve(); }, ms);
      timers.current.add(id);
    });
    const set = (update: (current: Scene) => Scene) => { if (!cancelledRef.current) setScene(update); };
    const patchActor = (id: ActorId, patch: Partial<Actor>) => set((current) => ({ ...current, actors: { ...current.actors, [id]: { ...current.actors[id], ...patch } } }));
    const face = (id: ActorId, facing: "L" | "R") => patchActor(id, { facing });
    const swap = (id: ActorId, pose: PoseId, facing?: "L" | "R") => patchActor(id, { pose, moveMs: 0, walking: false, ...(facing ? { facing } : {}) });
    const show = (id: ActorId, shown: boolean, fadeMs = 600) => patchActor(id, { shown, fadeMs });
    // Script-side positions (the cue script is the only writer), so walk durations follow distance / speed.
    const at = Object.fromEntries(Object.entries(initialScene().actors).map(([id, a]) => [id, a.x])) as Record<ActorId, number>;
    /**
     * Common walk helper: turn to face the walking direction → short beat → walk (procedural gait on) at a fixed
     * speed → stop (gait off, facing kept). Returns the arrival; fire-and-forget calls swallow cancellation.
     */
    const TURN_MS = 160;
    const walkTo = (id: ActorId, x: number, speed = U3EM_WALK_SPEED) => {
      const from = at[id];
      at[id] = x;
      const ms = Math.round((Math.abs(x - from) / speed) * 1000);
      patchActor(id, { facing: x >= from ? "R" : "L" });
      const arrival = wait(TURN_MS)
        .then(() => { patchActor(id, { x, moveMs: ms, walking: true, pace: speed > U3EM_WALK_SPEED ? "hurry" : "walk" }); return wait(ms); })
        .then(() => patchActor(id, { walking: false, moveMs: 0 }));
      arrival.catch(() => undefined);
      return arrival;
    };
    /** Instant reposition (scene changes): resets visibility, opacity, position, facing and pose. */
    const place = (id: ActorId, patch: Partial<Actor> & { x: number }) => { at[id] = patch.x; patchActor(id, { moveMs: 0, fadeMs: 0, walking: false, shown: true, ...patch }); };
    const alarm = (id: ActorId) => set((current) => ({ ...current, actors: { ...current.actors, [id]: { ...current.actors[id], alarm: current.actors[id].alarm + 1 } } }));
    const camera = (focus: number, ms: number) => set((current) => ({ ...current, cameraFocus: focus, cameraMs: ms }));
    const fog = (patch: Partial<Scene["fog"]>) => set((current) => ({ ...current, fog: { ...current.fog, ...patch } }));
    const curtain = (closed: boolean, ms: number) => set((current) => ({ ...current, curtain: closed, curtainMs: ms }));
    const say = (key: SegmentKey) => new Promise<void>((resolve, reject) => {
      if (cancelledRef.current) { reject(new Cancelled()); return; }
      segmentDone.current = () => { segmentDone.current = null; setSegment(null); if (cancelledRef.current) reject(new Cancelled()); else resolve(); };
      setSegment({ key, sequence: UNIT3_FLOOR3_EVENT_MAP_SEGMENTS[key] });
    });

    const run = async () => {
      const L = U3EM_LAYOUT;
      // 1) 3D view fades to black (curtain over the transparent root), scene assets decode, then fade in.
      await wait(30);
      curtain(true, 700);
      await Promise.all([wait(760), decodeAll(U3EM_IMAGE_URLS, 5000), preloadBarrierSpawn()]);
      if (cancelledRef.current) throw new Cancelled();
      setEntered(true);
      await wait(60);
      // Everyone walks in together from the left at one pace and the same distance (데네브 last, 카이든 leading).
      const entrance = (Object.keys(L.entrance) as ActorId[]).map((id) => walkTo(id, L.entrance[id as keyof typeof L.entrance]));
      curtain(false, 900);
      await wait(1000);
      // 2) 주민들과 학생들이 샛길을 따라 이동한다. / 검은 안개가 밀려온다.
      await say("intro");
      await Promise.all(entrance);
      rumble.current = startFogRumble();
      camera(820, 1600);
      fog({ shown: true, front: 280, moveMs: 3600 });
      await wait(1500);
      (["student", "resident1", "resident2", "official"] as const).forEach((id) => { face(id, "L"); });
      alarm("student"); alarm("resident1"); alarm("resident2");
      await wait(1900);
      await say("alarm");
      // 3) 데네브·카프: turn left → walk left → stop → defense pose → barrier to their left.
      await Promise.all([walkTo("deneb", L.defenders.deneb), walkTo("kaf", L.defenders.kaf)]);
      await wait(200);
      swap("deneb", "denebDefense", "L");
      swap("kaf", "kafPeriodDefense", "L");
      await wait(250);
      barrierSfx.current = playBarrierSpawn(); // supplied recording, once
      set((current) => ({ ...current, barrier: "spawn" }));
      await wait(760);
      fog({ front: U3EM_FOG_CONTACT_FRONT, moveMs: 900 });
      await wait(950);
      // contact → impacts repeat (impact loop effect below)
      set((current) => ({ ...current, impact: current.impact + 1 }));
      // 4) 학교 관계자 → 학생 → 주민 → 주민 leave right in turn (fade); 카이든 walks ahead and waits on the right.
      camera(1150, 2200);
      const kaidenAhead = walkTo("kaiden", L.kaidenWait);
      for (const id of ["official", "student", "resident2", "resident1"] as const) {
        void walkTo(id, 2400, U3EM_HURRY_SPEED);
        timers.current.add(window.setTimeout(() => show(id, false, 900), 3200));
        await wait(520);
      }
      await kaidenAhead;
      await wait(2600);
      face("kaiden", "L"); // 카이든 turns back to call the two (his next line)
      camera(1050, 1400);
      await wait(600);
      await say("holding");
      // 5) Flashback: dim + 2단원 데네브 구출 장면 (fog, barrier and NPCs paused). It stays up while 카프's
      //    memory lines play in the flashback dialogue style (her own Adventure Academy portrait).
      set((current) => ({ ...current, dim: true }));
      await wait(700);
      set((current) => ({ ...current, flashback: true }));
      await wait(1400);
      set((current) => ({ ...current, memoryStyle: true }));
      await say("memory");
      // back to the present: dialogue hidden → illustration fades → dim lifts → normal dialogue style
      await wait(350);
      set((current) => ({ ...current, flashback: false }));
      await wait(750);
      set((current) => ({ ...current, dim: false }));
      await wait(700);
      set((current) => ({ ...current, memoryStyle: false }));
      await say("flashback"); // 데네브: 카프, 저를 봐요… (카프 still in the 개화기 defense pose)
      // 6) Memory recovery: dialogue hidden; light wells up round 카프, wraps her, and at its brightest frame the
      //    academy defense pose replaces the 개화기 one; the light scatters; short silence; dialogue resumes.
      await wait(300);
      // The swap is driven by the sprite's own frame clock (peak frame reached), not a parallel timer, so it
      // always lands on the brightest frame; the timeouts are only a fallback.
      await new Promise<void>((resolve, reject) => {
        let swapped = false;
        const fallback = window.setTimeout(() => awakenCue.current?.("end"), U3EM_MEMORY_VFX.durationMs + 1500);
        timers.current.add(fallback);
        awakenCue.current = (cue) => {
          if (cancelledRef.current) { awakenCue.current = null; reject(new Cancelled()); return; }
          if (!swapped && (cue === "peak" || cue === "end")) { swapped = true; swap("kaf", "kafDefense", "L"); }
          if (cue === "end") { awakenCue.current = null; window.clearTimeout(fallback); timers.current.delete(fallback); set((current) => ({ ...current, awakenOn: false })); resolve(); }
        };
        set((current) => ({ ...current, awaken: current.awaken + 1, awakenOn: true }));
      });
      await wait(700); // 짧은 정적
      await say("recognition");
      await wait(1700); // 잠시 정적
      await say("remembered");
      // 6) Release, in this exact order; no dialogue after the retreat call.
      swap("deneb", "deneb", "R");
      await wait(350);
      await walkTo("deneb", L.defenders.deneb + 25);
      await wait(150);
      swap("kaf", "kafAcademy", "R");
      await wait(400);
      await say("retreat");
      // turn right → walk right (all at one hurried pace, gaps kept) → far enough → barrier released → fog resumes.
      void walkTo("deneb", at.deneb + 1150, U3EM_HURRY_SPEED);
      void walkTo("kaf", at.kaf + 1150, U3EM_HURRY_SPEED);
      void walkTo("kaiden", at.kaiden + 1150, U3EM_HURRY_SPEED);
      camera(1500, 2600);
      await wait(1450);
      set((current) => ({ ...current, barrier: "despawn" }));
      await wait(800);
      fog({ front: 1300, moveMs: 2600 });
      await wait(1300);
      curtain(true, 900); // fade out before the fog reaches anyone
      rumble.current?.stop(900);
      rumble.current = null;
      await wait(1100);
      // 7) Safe alley: fog and barrier gone, all seven people back (visibility/opacity/position/facing reset).
      set((current) => ({ ...current, fog: { shown: false, front: -400, moveMs: 0, fadeMs: 0 }, barrier: "none", dim: false, flashback: false }));
      const A = L.safeAlley;
      place("deneb", { x: A.deneb, pose: "deneb", facing: "R" });
      place("kaf", { x: A.kaf, pose: "kafAcademy", facing: "R" });
      place("kaiden", { x: A.kaiden, facing: "L" });
      place("student", { x: A.student, facing: "L" });
      place("official", { x: A.official, facing: "L" });
      place("resident1", { x: A.resident1, facing: "L" });
      place("resident2", { x: A.resident2, facing: "L" });
      camera((A.deneb + A.resident2) / 2, 0);
      await wait(500);
      curtain(false, 900);
      await wait(1000);
      await say("safeAlley");
      curtain(true, 900);
      await wait(1100);
      finish();
    };
    run().catch((error) => { if (!(error instanceof Cancelled)) { console.error(error); finish(); } });
    const pending = timers.current;
    return () => {
      cancelledRef.current = true;
      pending.forEach((id) => window.clearTimeout(id));
      pending.clear();
      rumble.current?.stop(200);
      rumble.current = null;
      barrierSfx.current?.stop(100);
      barrierSfx.current = null;
    };
  }, [finish]);

  // Repeated impacts while the fog presses on the held barrier (not during the flashback).
  const pressing = scene.barrier === "hold" && scene.impact > 0 && !scene.dim;
  useEffect(() => {
    if (!pressing) return;
    const id = window.setInterval(() => {
      playBarrierImpact();
      setScene((current) => ({ ...current, impact: current.impact + 1 }));
    }, 1450);
    playBarrierImpact();
    return () => window.clearInterval(id);
  }, [pressing]);

  const paused = scene.dim;
  const L = U3EM_LAYOUT;
  const barrierLeft = L.barrierX - L.barrierFrame.bottomEnd[0] * L.barrierScale;
  const barrierTop = U3EM_SCENE.groundY - L.barrierFrame.bottomEnd[1] * L.barrierScale;
  const fogLeft = scene.fog.front - L.fogFrame.frontX * L.fogScale;
  const fogTop = U3EM_SCENE.groundY + 6 - L.fogFrame.bottomY * L.fogScale;
  const actors = useMemo(() => Object.entries(scene.actors) as [ActorId, Actor][], [scene.actors]);

  return (
    <div ref={rootRef} className={`u3em-root ${entered ? "is-entered" : ""} ${paused ? "is-paused" : ""}`} data-testid="u3-event-map"
      data-barrier={scene.barrier} data-flashback={scene.flashback ? "1" : "0"} data-segment={segment?.key ?? ""}>
      <div className="u3em-camera" style={{ transform: `translate3d(${-cameraX * scale}px,${sceneTop}px,0) scale(${scale})`, transitionDuration: `${scene.cameraMs}ms` }}>
        <div className="u3em-scene" style={{ width: U3EM_SCENE.width, height: U3EM_SCENE.height }}>
          <img className="u3em-layer u3em-bg" src={U3EM_IMAGES.background} alt="" draggable={false} />
          <img className="u3em-layer u3em-wall" src={U3EM_IMAGES.wall} alt="" draggable={false} />
          <img className="u3em-layer u3em-ground" src={U3EM_IMAGES.ground} alt="" draggable={false} />
          <div className={`u3em-fog ${scene.fog.shown ? "is-shown" : ""}`} data-front={scene.fog.front}
            style={{ transform: `translate3d(${fogLeft}px, ${fogTop}px, 0)`, transitionDuration: `${scene.fog.moveMs}ms, ${scene.fog.fadeMs}ms` }}>
            <div className="u3em-fog-trail" style={{ width: 2400, height: (L.fogFrame.bottomY - 24) * L.fogScale, top: 24 * L.fogScale, right: (L.fogFrame.w - L.fogFrame.leftAnchorX - 2) * L.fogScale }} />
            <GridSprite src={U3EM_IMAGES.fog} cols={4} rows={4} frames={16} fps={8} frameW={384} frameH={128} scale={L.fogScale} loop paused={paused} />
          </div>
          {actors.map(([id, a]) => {
            const pose = U3EM_POSES[a.pose];
            const elementH = pose.visibleH * pose.h / (pose.bottom - pose.top);
            const elementW = elementH * pose.w / pose.h;
            const below = (pose.h - pose.bottom) / pose.h * elementH;
            const flip = a.facing !== pose.natural;
            return (
              <div key={id} className={`u3em-actor ${a.shown ? "is-shown" : ""}`} data-actor={id} data-facing={a.facing} data-pose={a.pose} data-walking={a.walking ? "1" : "0"}
                style={{ left: a.x - ((pose.left + pose.right) / 2 / pose.w - 0.5) * elementW * (flip ? -1 : 1), top: U3EM_SCENE.groundY + below - elementH, width: elementW, height: elementH, zIndex: 10 + a.z,
                  transitionDuration: `${a.moveMs}ms, ${a.fadeMs}ms`, ["--walk-phase" as string]: `${-(a.z * 137) % 560}ms`, ["--foot-y" as string]: `${(pose.bottom / pose.h) * 100}%` }}>
                <div className={`u3em-walker ${a.walking ? `is-walking is-${a.pace}` : ""}`}>
                  <img src={pose.src} alt="" draggable={false} style={{ transform: flip ? "scaleX(-1)" : undefined }} />
                </div>
                {a.alarm > 0 && <GridSprite key={a.alarm} className="u3em-exclamation" src={U3EM_IMAGES.exclamation} cols={12} rows={1} frames={12} fps={7} frameW={60} frameH={60} scale={1.5}
                  loop={false} style={{ top: (pose.top / pose.h) * elementH - 96 }} />}
              </div>
            );
          })}
          {scene.awakenOn && (() => {
            const M = U3EM_MEMORY_VFX, kaf = scene.actors.kaf;
            return <GridSprite key={`awaken-${scene.awaken}`} className="u3em-awaken" src={U3EM_IMAGES.memoryAwakening} cols={M.cols} rows={M.rows} frames={M.frames} fps={M.fps}
              frameW={M.frameW} frameH={M.frameH} scale={M.scale} loop={false}
              onFrame={(index) => { if (index >= M.peakFrame) awakenCue.current?.("peak"); }} onEnd={() => awakenCue.current?.("end")}
              style={{ left: kaf.x - M.pivotX * M.scale, top: U3EM_SCENE.groundY - M.pivotY * M.scale }} />;
          })()}
          {scene.barrier !== "none" && (
            <div className="u3em-barrier" style={{ left: barrierLeft, top: barrierTop }} data-phase={scene.barrier}>
              {scene.barrier === "spawn" && <GridSprite src={U3EM_IMAGES.barrierSpawn} cols={4} rows={3} frames={12} fps={16} frameW={128} frameH={256} scale={L.barrierScale}
                loop={false} onEnd={() => setScene((current) => current.barrier === "spawn" ? { ...current, barrier: "hold" } : current)} />}
              {scene.barrier === "hold" && <GridSprite src={U3EM_IMAGES.barrierHold} cols={4} rows={4} frames={16} fps={8} frameW={128} frameH={256} scale={L.barrierScale} loop paused={paused} />}
              {scene.barrier === "hold" && scene.impact > 0 && <GridSprite key={`impact-${scene.impact}`} className="u3em-impact" src={U3EM_IMAGES.barrierImpact} cols={5} rows={2} frames={10} fps={16}
                frameW={128} frameH={256} scale={L.barrierScale} loop={false} paused={paused} />}
              {scene.barrier === "despawn" && <GridSprite className="u3em-despawn" src={U3EM_IMAGES.barrierDespawn} cols={4} rows={3} frames={12} fps={16} frameW={128} frameH={256} scale={L.barrierScale} loop={false} />}
            </div>
          )}
        </div>
      </div>
      <div className="story-player story-player-baseCampOverlay u3em-probe" aria-hidden="true"><div ref={probeRef} className="story-dialogue-box" /></div>
      <div className={`u3em-dim ${scene.dim ? "is-on" : ""}`} />
      <div className={`u3em-flashback ${scene.flashback ? "is-on" : ""}`} aria-hidden="true">
        <div className="u3em-flashback-map">
          <img className="d7-layer" src={U3EM_IMAGES.prisonBackground} alt="" />
          <img className="d7-layer" src={U3EM_IMAGES.prisonForeground} alt="" />
          <img className="d7-layer" src={U3EM_IMAGES.prisonCaptive} alt="" />
          {[lunaStanding, theoStanding, kappStandingR, aronStanding].map((src, index) => (
            <div key={src} className="u3em-flashback-member" style={{ left: `${39 + index * 5}%` }}><img src={src} alt="" /></div>
          ))}
          <img className="d7-layer" src={U3EM_IMAGES.prisonGround} alt="" />
        </div>
      </div>
      <div className={`u3em-curtain ${scene.curtain ? "is-closed" : ""}`} style={{ transitionDuration: `${scene.curtainMs}ms` }} />
      {segment && (
        <div className={`u3em-dialogue ${scene.memoryStyle ? "is-memory" : ""}`}>
          <StoryPlayer key={segment.key} sequence={{ ...segment.sequence, dialogueSkip: false }} playerName={playerName} playerStatus={playerStatus}
            presentationMode="baseCampOverlay" onNavigate={() => undefined} onComplete={() => segmentDone.current?.()} />
        </div>
      )}
      {/* Hotfix: one skip button — the existing bottom-right 「건너뛰기」 design — and it skips the whole event map
          (segments run with dialogueSkip off, so StoryPlayer shows no second button). */}
      <button type="button" className="story-dialogue-skip-button u3em-skip" onClick={finish}>건너뛰기</button>
    </div>
  );
}
