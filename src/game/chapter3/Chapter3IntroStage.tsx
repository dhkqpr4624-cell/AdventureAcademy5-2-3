import { useEffect, useRef, type CSSProperties } from "react";
import { CHAPTER3_ASSETS, CHAPTER3_MAP_SIZE } from "../../data/chapter3/chapter3Assets";
import { CHAPTER3_STAGE_SPRITES, STAGE_SPRITE_SCALE } from "../../data/chapter3/chapter3Actors";
import {
  ARRIVAL_DROP_MS,
  ARRIVAL_SKY_CRACK,
  CHAPTER3_INTRO_PHASES,
  HQ_GLOBE,
  STAGE_FOOT_Y,
  type StageActorState,
  type StageAudioCue,
  type StagePhase,
} from "../../data/chapter3/chapter3IntroStage";
import { crossfadeBgm, duckBgm, fadeOutBgm, playBgm } from "../audioBgm";
import { startWarpCharge, startWindLoop, type Chapter3SfxHandle, type WarpHandle } from "../audio/chapter3ProceduralSfx";
import { MapLayer, MapStage } from "./MapStage";
import { LoopingLayer } from "./LoopingLayer";
import { SpriteSheetVfx } from "./SpriteSheetVfx";
import { StageActor } from "./StageActor";

const { width: W, height: H } = CHAPTER3_MAP_SIZE;

/** z order inside the map world (back → front). */
export const STAGE_Z = {
  sky: 0,
  cloud: 1,
  skyProp: 2,
  backgroundOutside: 3,
  background: 4,
  foreground: 5,
  foregroundVfx: 6,
  npc: 8,
  ground: 9,
  /** transfer circles + light columns sit on top of the floor strip, in front of the feet */
  circles: 10,
} as const;

/** Audio owned by the intro stage. Everything is released when the stage unmounts (map change, title, base camp). */
function useStageAudio(phaseName: string, revision: number, cues: readonly StageAudioCue[] | undefined) {
  const wind = useRef<Chapter3SfxHandle | null>(null);
  const warp = useRef<WarpHandle | null>(null);
  const handled = useRef<number>(-1);

  useEffect(() => {
    if (!cues?.length || handled.current === revision) return;
    handled.current = revision;
    for (const cue of cues) {
      // HQ theme: starts with the HQ map and keeps looping through dialogue, choices, entrances and the warp charge.
      // playBgm() is idempotent for the active track, so a repeated cue never restarts it.
      if (cue === "bgm-hq") playBgm("unit3-hq", undefined, { loop: true, volume: 0.42, fadeInMs: 1200 });
      if (cue === "bgm-tension") void crossfadeBgm("unit3-tension", 2200, { loop: true, volume: 0.42, fadeInMs: 1800 });
      if (cue === "warp-start") {
        // the theme stays under the warp charge, ducked ~4.4 dB so the rising charge reads clearly over it
        duckBgm(0.6, 1500, "unit3-hq");
        warp.current?.stop(100);
        warp.current = startWarpCharge(4600);
      }
      if (cue === "warp-distort") {
        warp.current?.distort();
        // The warp flash ends the HQ: the theme fades out with the white-out / fade to black (never reaches the arrival map).
        void fadeOutBgm(1200, "unit3-hq");
      }
      if (cue === "wind-start") {
        wind.current?.stop(200);
        wind.current = startWindLoop(0.2, 2400);
      }
    }
  }, [cues, phaseName, revision]);

  useEffect(() => () => {
    handled.current = -1;
    wind.current?.stop(500);
    warp.current?.stop(200);
    wind.current = null;
    warp.current = null;
  }, []);
}

function Exclamation({ actor }: { actor: StageActorState }) {
  const sprite = CHAPTER3_STAGE_SPRITES[actor.id];
  const top = sprite.head * sprite.frameHeight * STAGE_SPRITE_SCALE;
  return <span className="stage-exclaim" style={{ top: top - 56, backgroundImage: `url("${CHAPTER3_ASSETS.vfx.exclamationSheet}")` }} aria-hidden="true" />;
}

function MagicCircle({ x, y }: { x: number; y: number }) {
  return (
    <div className="stage-magic-circle" style={{ left: x, top: y }} aria-hidden="true">
      <div className="stage-magic-circle-plane">
        <svg viewBox="-100 -100 200 200" className="stage-magic-circle-svg">
          <circle r="92" className="ring outer" />
          <circle r="80" className="ring dashed" />
          <circle r="56" className="ring inner" />
          <polygon points="0,-80 69,40 -69,40" className="ring tri" />
          <polygon points="0,80 69,-40 -69,-40" className="ring tri" />
          {Array.from({ length: 12 }, (_, index) => (
            <rect key={index} x="-3" y="-90" width="6" height="10" className="rune" transform={`rotate(${index * 30})`} />
          ))}
        </svg>
      </div>
      <span className="stage-warp-pillar" />
    </div>
  );
}

function SkyCrack() {
  const { x, y, width, height } = ARRIVAL_SKY_CRACK;
  const rift = "M18 96 L64 104 L84 80 L118 112 L146 92 L170 126 L204 104 L236 140 L286 128 L346 150 L296 152 L240 160 L204 132 L174 150 L146 120 L118 138 L86 108 L62 122 Z";
  const branches = "M84 80 L74 44 L88 22 M146 92 L156 58 M204 104 L216 70 L240 56 M170 126 L162 170 L176 206 M236 140 L252 182 M118 138 L100 176";
  return (
    <svg className="stage-sky-crack" style={{ left: x - width / 2, top: y - height / 2, width, height, zIndex: STAGE_Z.skyProp }} viewBox="0 0 360 230" aria-hidden="true">
      <defs>
        <radialGradient id="crack-haze">
          <stop offset="0" stopColor="#c47dff" stopOpacity="0.6" />
          <stop offset="1" stopColor="#4b1480" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="crack-void" x1="0" x2="1">
          <stop offset="0" stopColor="#14041f" />
          <stop offset="0.5" stopColor="#3a0b5e" />
          <stop offset="1" stopColor="#14041f" />
        </linearGradient>
      </defs>
      <ellipse cx="180" cy="125" rx="178" ry="108" fill="url(#crack-haze)" className="crack-haze" />
      <path className="crack-glow" d={branches} />
      <path className="crack-rift-glow" d={rift} />
      <path className="crack-rift" d={rift} fill="url(#crack-void)" />
      <path className="crack-core" d={branches} />
    </svg>
  );
}

export function Chapter3IntroStage({ phase, revision }: { phase: string; revision: number }) {
  const state: StagePhase | undefined = CHAPTER3_INTRO_PHASES[phase];
  useStageAudio(phase, revision, state?.audio);
  if (!state) return null;
  const footY = STAGE_FOOT_Y[state.map];
  const actors = state.actors.map((actor) => (
    <StageActor key={`${state.map}-${actor.id}`} id={actor.id} x={actor.x} footY={footY} facing={actor.facing} walking={actor.walking} moveMs={actor.moveMs} enter={actor.enter}>
      {actor.exclaim && <Exclamation actor={actor} />}
    </StageActor>
  ));
  const circles = state.actors.filter((actor) => actor.circle).map((actor) => <MagicCircle key={actor.id} x={actor.x} y={footY} />);
  return (
    <div className={`chapter3-stage chapter3-stage-${state.map} ${state.warp ? `is-warp-${state.warp}` : ""}`} data-phase={phase} aria-hidden="true">
      <MapStage key={state.map} width={W} height={H} camera={state.camera}>
        {state.map === "hq" ? (
          <>
            <MapLayer src={CHAPTER3_ASSETS.sky} z={STAGE_Z.sky} />
            <LoopingLayer src={CHAPTER3_ASSETS.hq.cloudAtmosphere} width={W} height={H} speed={16} z={STAGE_Z.cloud} />
            <MapLayer src={CHAPTER3_ASSETS.hq.skyProps} z={STAGE_Z.skyProp} className="hq-sky-props" />
            <MapLayer src={CHAPTER3_ASSETS.hq.backgroundOutside} z={STAGE_Z.backgroundOutside} />
            <MapLayer src={CHAPTER3_ASSETS.hq.background} z={STAGE_Z.background} />
            <MapLayer src={CHAPTER3_ASSETS.hq.foreground} z={STAGE_Z.foreground} />
            <SpriteSheetVfx sheetUrl={CHAPTER3_ASSETS.vfx.holoGlobeSheet} jsonUrl={CHAPTER3_ASSETS.vfx.holoGlobeJson} x={HQ_GLOBE.x} y={HQ_GLOBE.y} scale={HQ_GLOBE.scale} z={STAGE_Z.foregroundVfx} className="hq-holo-globe" />
            <div className="map-stage-group" style={{ zIndex: STAGE_Z.npc }}>{actors}</div>
            <MapLayer src={CHAPTER3_ASSETS.hq.ground} z={STAGE_Z.ground} />
            <div className="map-stage-group" style={{ zIndex: STAGE_Z.circles }}>{circles}</div>
          </>
        ) : (
          <>
            <MapLayer src={CHAPTER3_ASSETS.sky} z={STAGE_Z.sky} />
            <SkyCrack />
            <MapLayer src={CHAPTER3_ASSETS.arrival.background} z={STAGE_Z.background} />
            <div
              className={`map-stage-group arrival-drop-group ${state.drop ? "is-dropping" : ""}`}
              style={{ zIndex: STAGE_Z.foreground, transitionDuration: `${ARRIVAL_DROP_MS}ms` } as CSSProperties}
              data-testid="arrival-drop-group"
            >
              <MapLayer src={CHAPTER3_ASSETS.arrival.foreground} z={1} />
              <div className="map-stage-group" style={{ zIndex: 2 }}>{actors}</div>
              <MapLayer src={CHAPTER3_ASSETS.arrival.ground} z={3} />
            </div>
          </>
        )}
      </MapStage>
      <div className={`chapter3-stage-dim ${state.dim ? "is-visible" : ""}`} />
      {state.warp ? <div className="chapter3-warp-bloom" /> : null}
      {state.flash && <div key={revision} className="chapter3-white-flash" />}
    </div>
  );
}
