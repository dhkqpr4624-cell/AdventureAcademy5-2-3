import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StoryPlayer } from "../../story/StoryPlayer";
import type { StorySequence } from "../../../types/story";
import { UNIT3_FLOOR3_EVENT_MAP_SEGMENTS } from "../../../data/chapter3/floor3Stories";
import { CHAPTER3_STAGE_SPRITES } from "../../../data/chapter3/chapter3Actors";
import { playBarrierImpact, playBarrierSpawn, startFogRumble, type Chapter3SfxHandle } from "../../audio/chapter3ProceduralSfx";
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
  exclamation: `${BASE}assets/story/chapter2/intro/exclamation-sheet.png`,
  prisonBackground: `${BASE}assets/dungeon7/prison-background.png`,
  prisonForeground: `${BASE}assets/dungeon7/prison-foreground.png`,
  prisonGround: `${BASE}assets/dungeon7/prison-ground.png`,
  prisonCaptive: `${BASE}assets/dungeon7/captive-deneb.png`,
} as const;

/** Image + measured alpha box (top/bottom rows) + natural facing. */
type Pose = { src: string; w: number; h: number; top: number; bottom: number; natural: "L" | "R"; visibleH: number };
export const U3EM_POSES = {
  deneb: { src: `${BASE}assets/npcs/chapter2/deneb/standing_R.png`, w: 400, h: 700, top: 38, bottom: 682, natural: "R", visibleH: 236 },
  denebDefense: { src: `${F3}standing/deneb-defense-R.png`, w: 948, h: 1659, top: 133, bottom: 1462, natural: "R", visibleH: 268 },
  kaiden: { src: CHAPTER3_STAGE_SPRITES.kaiden.images.L!, w: 600, h: 700, top: 23, bottom: 671, natural: "L", visibleH: 250 },
  kafPeriod: { src: `${BASE}assets/chapter3/floor2/standing/kaf-period.png`, w: 843, h: 1329, top: 4, bottom: 1319, natural: "L", visibleH: 232 },
  kafDefense: { src: `${F3}standing/kaf-defense-R.png`, w: 948, h: 1659, top: 283, bottom: 1461, natural: "R", visibleH: 232 },
  kafAcademy: { src: kappStandingR, w: 400, h: 700, top: 132, bottom: 681, natural: "R", visibleH: 222 },
  student: { src: `${F3}standing/student.png`, w: 255, h: 383, top: 4, bottom: 380, natural: "R", visibleH: 176 },
  official: { src: `${F3}standing/school-official.png`, w: 341, h: 512, top: 5, bottom: 509, natural: "R", visibleH: 240 },
  resident1: { src: `${F3}standing/resident1.png`, w: 154, h: 247, top: 4, bottom: 242, natural: "R", visibleH: 214 },
  resident2: { src: `${F3}standing/resident2.png`, w: 299, h: 327, top: 2, bottom: 324, natural: "R", visibleH: 222 },
} satisfies Record<string, Pose>;
type PoseId = keyof typeof U3EM_POSES;

export const U3EM_IMAGE_URLS: string[] = [
  ...Object.values(U3EM_IMAGES), ...Object.values(U3EM_POSES).map((pose) => pose.src),
  lunaStanding, theoStanding, kappStandingR, aronStanding,
];

type ActorId = "deneb" | "kaf" | "kaiden" | "student" | "official" | "resident1" | "resident2";
type Actor = { pose: PoseId; x: number; facing: "L" | "R"; shown: boolean; moveMs: number; fadeMs: number; z: number; alarm: number };
type Scene = {
  actors: Record<ActorId, Actor>;
  cameraFocus: number; cameraMs: number;
  /** x of the fog's front edge (scene units) and its move duration. */
  fog: { shown: boolean; front: number; moveMs: number; fadeMs: number };
  barrier: "none" | "spawn" | "hold" | "despawn";
  impact: number; dim: boolean; flashback: boolean; curtain: boolean; curtainMs: number;
};

/** Layout (scene units). Barrier: bottom end on the ground at BARRIER_X; the fog stops at its apex. */
export const U3EM_LAYOUT = {
  barrierX: 720, barrierScale: 1.36, fogScale: 2.6,
  barrierFrame: { w: 128, h: 256, apex: [40, 128] as const, bottomEnd: [86, 240] as const, contact: [41, 150] as const },
  /** frontX: the point of the fog body that presses on the barrier (the thin wisp tail beyond it stays behind the barrier). */
  fogFrame: { w: 384, h: 128, leftAnchorX: 8, bottomY: 119, frontX: 350 },
  defenders: { deneb: 820, kaf: 905 },
  kaidenWait: 1720,
} as const;
const barrierApexX = U3EM_LAYOUT.barrierX - (U3EM_LAYOUT.barrierFrame.bottomEnd[0] - U3EM_LAYOUT.barrierFrame.apex[0]) * U3EM_LAYOUT.barrierScale;
export const U3EM_FOG_CONTACT_FRONT = Math.round(barrierApexX + 6);

const actor = (pose: PoseId, x: number, facing: "L" | "R", z: number, shown = true): Actor => ({ pose, x, facing, shown, moveMs: 0, fadeMs: 600, z, alarm: 0 });
const initialScene = (): Scene => ({
  actors: {
    resident1: actor("resident1", 330, "R", 6), resident2: actor("resident2", 430, "R", 7),
    student: actor("student", 530, "R", 8), official: actor("official", 630, "R", 5),
    deneb: actor("deneb", 900, "R", 3), kaf: actor("kafPeriod", 990, "R", 4), kaiden: actor("kaiden", 1640, "R", 2),
  },
  cameraFocus: 1050, cameraMs: 0,
  fog: { shown: false, front: -120, moveMs: 0, fadeMs: 600 },
  barrier: "none", impact: 0, dim: false, flashback: false, curtain: false, curtainMs: 0,
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
    const move = (id: ActorId, x: number, ms: number, facing?: "L" | "R") => patchActor(id, { x, moveMs: ms, ...(facing ? { facing } : {}) });
    const face = (id: ActorId, facing: "L" | "R") => patchActor(id, { facing });
    const swap = (id: ActorId, pose: PoseId, facing?: "L" | "R") => patchActor(id, { pose, moveMs: 0, ...(facing ? { facing } : {}) });
    const show = (id: ActorId, shown: boolean, fadeMs = 600) => patchActor(id, { shown, fadeMs });
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
      // 1) 3D view fades to black (curtain over the transparent root), scene assets decode, then fade in.
      await wait(30);
      curtain(true, 700);
      await Promise.all([wait(760), decodeAll(U3EM_IMAGE_URLS, 5000)]);
      if (cancelledRef.current) throw new Cancelled();
      setEntered(true);
      await wait(60);
      ["resident1", "resident2", "student", "official"].forEach((id, index) => move(id as ActorId, 1130 + index * 105, 6400));
      curtain(false, 900);
      await wait(1000);
      // 2) 주민들과 학생들이 샛길을 따라 이동한다. / 검은 안개가 밀려온다.
      await say("intro");
      rumble.current = startFogRumble();
      camera(820, 1600);
      fog({ shown: true, front: 430, moveMs: 3600 });
      await wait(1500);
      (["student", "resident1", "resident2", "official"] as const).forEach((id) => { face(id, "L"); });
      alarm("student"); alarm("resident1"); alarm("resident2");
      await wait(1900);
      await say("alarm");
      // 3) 데네브·카프: left side by side, defense poses facing left, barrier to their left.
      move("deneb", U3EM_LAYOUT.defenders.deneb, 900, "L");
      move("kaf", U3EM_LAYOUT.defenders.kaf, 900, "L");
      await wait(950);
      swap("deneb", "denebDefense", "L");
      swap("kaf", "kafDefense", "L");
      await wait(250);
      playBarrierSpawn();
      set((current) => ({ ...current, barrier: "spawn" }));
      await wait(760);
      fog({ front: U3EM_FOG_CONTACT_FRONT, moveMs: 1700 });
      await wait(1750);
      // contact → impacts repeat (impact loop effect below)
      set((current) => ({ ...current, impact: current.impact + 1 }));
      // 4) 주민·학생·학교 관계자 exit right in turn (fade); 카이든 waits on the right.
      camera(1150, 2200);
      move("kaiden", U3EM_LAYOUT.kaidenWait, 2600, "R");
      for (const id of ["resident1", "resident2", "student", "official"] as const) {
        face(id, "R");
        move(id, 2300, 3200);
        timers.current.add(window.setTimeout(() => show(id, false, 900), 2100));
        await wait(520);
      }
      await wait(2600);
      face("kaiden", "L");
      camera(1050, 1400);
      await wait(600);
      await say("holding");
      // 5) Flashback: dim, 2단원 데네브 구출 장면 (no UI); fog, barrier and NPCs paused; then back.
      set((current) => ({ ...current, dim: true }));
      await wait(700);
      set((current) => ({ ...current, flashback: true }));
      await wait(3800);
      set((current) => ({ ...current, flashback: false }));
      await wait(700);
      set((current) => ({ ...current, dim: false }));
      await wait(600);
      await say("flashback");
      await say("recognition");
      await wait(1700); // 잠시 정적
      await say("remembered");
      // 6) Release, in this exact order; no dialogue after the retreat call.
      swap("deneb", "deneb", "R");
      await wait(350);
      move("deneb", U3EM_LAYOUT.defenders.deneb + 40, 450);
      await wait(500);
      swap("kaf", "kafAcademy", "R");
      await wait(400);
      await say("retreat");
      move("deneb", 2350, 2600);
      move("kaf", 2420, 2600);
      move("kaiden", 2500, 2200, "R");
      camera(1500, 2600);
      await wait(500);
      set((current) => ({ ...current, barrier: "despawn" }));
      await wait(800);
      fog({ front: 1500, moveMs: 2600 });
      await wait(1500);
      curtain(true, 900); // fade out before the fog reaches anyone
      rumble.current?.stop(900);
      rumble.current = null;
      await wait(1100);
      // 7) Safe alley: fog and barrier gone, NPCs repositioned, fade in, dialogue, fade out.
      setScene((current) => ({
        ...current,
        fog: { shown: false, front: -400, moveMs: 0, fadeMs: 0 }, barrier: "none", dim: false, flashback: false,
        cameraFocus: 1500, cameraMs: 0,
        actors: {
          ...current.actors,
          deneb: { ...current.actors.deneb, pose: "deneb", x: 1180, facing: "R", moveMs: 0, shown: true, fadeMs: 0 },
          kaf: { ...current.actors.kaf, pose: "kafAcademy", x: 1290, facing: "R", moveMs: 0, shown: true, fadeMs: 0 },
          kaiden: { ...current.actors.kaiden, x: 1430, facing: "L", moveMs: 0, shown: true, fadeMs: 0 },
          student: { ...current.actors.student, x: 1590, facing: "L", moveMs: 0, shown: true, fadeMs: 0 },
          official: { ...current.actors.official, x: 1700, facing: "L", moveMs: 0, shown: true, fadeMs: 0 },
          resident1: { ...current.actors.resident1, shown: false, fadeMs: 0 },
          resident2: { ...current.actors.resident2, shown: false, fadeMs: 0 },
        },
      }));
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
              <div key={id} className={`u3em-actor ${a.shown ? "is-shown" : ""}`} data-actor={id} data-facing={a.facing} data-pose={a.pose}
                style={{ left: a.x, top: U3EM_SCENE.groundY + below - elementH, width: elementW, height: elementH, zIndex: 10 + a.z,
                  transitionDuration: `${a.moveMs}ms, ${a.fadeMs}ms` }}>
                <img src={pose.src} alt="" draggable={false} style={{ transform: flip ? "scaleX(-1)" : undefined }} />
                {a.alarm > 0 && <GridSprite key={a.alarm} className="u3em-exclamation" src={U3EM_IMAGES.exclamation} cols={12} rows={1} frames={12} fps={7} frameW={60} frameH={60} scale={1.5}
                  loop={false} style={{ top: (pose.top / pose.h) * elementH - 96 }} />}
              </div>
            );
          })}
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
        <div className="u3em-dialogue">
          <StoryPlayer key={segment.key} sequence={segment.sequence} playerName={playerName} playerStatus={playerStatus}
            presentationMode="baseCampOverlay" onNavigate={() => undefined} onComplete={() => segmentDone.current?.()} />
        </div>
      )}
      <button type="button" className="story-skip-button u3em-skip" onClick={finish}>이벤트 건너뛰기</button>
    </div>
  );
}
