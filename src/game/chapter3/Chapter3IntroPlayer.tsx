import { useEffect, useMemo, useState } from "react";
import type { ScreenId } from "../../app/routes";
import { StoryPlayer } from "../story/StoryPlayer";
import { CHAPTER3_ASSETS, CHAPTER3_MAP_SIZE } from "../../data/chapter3/chapter3Assets";
import { CHAPTER3_INTRO_ARRIVAL_SEQUENCE, CHAPTER3_INTRO_HQ_SEQUENCE, CHAPTER3_INTRO_IMAGE_URLS, CHAPTER3_INTRO_STORY_ID, CHAPTER3_STAGE_ID, type Chapter3IntroState } from "../../data/chapter3/chapter3IntroScript";
import { CHAPTER3_STORY_ACTORS } from "../../data/chapter3/chapter3Actors";
import { Chapter3IntroStage } from "./Chapter3IntroStage";
import { prepareLoopTile } from "./LoopingLayer";
import { loadSheetJson } from "./SpriteSheetVfx";
import { stopAllChapter3Sfx } from "../audio/chapter3ProceduralSfx";
import { fadeOutBgm } from "../audioBgm";

const STAGE_RENDERERS = {
  [CHAPTER3_STAGE_ID]: (phase: string, revision: number) => <Chapter3IntroStage phase={phase} revision={revision} />,
};

function preloadImage(url: string) {
  return new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = () => { if (image.decode) void image.decode().catch(() => undefined).then(() => resolve()); else resolve(); };
    image.onerror = () => resolve();
    image.src = url;
  });
}

/**
 * Unit 3 intro (HQ → dungeon arrival). Loads every layer, loop tile, VFX sheet and portrait first so the
 * first frame of each map is complete, then plays the shared StoryPlayer with the chapter3 stage renderer.
 * A reload during the intro starts it again from the beginning (allowed by the spec).
 */
export function Chapter3IntroPlayer({ playerName, onNavigate, onStarted, onCompleted }: {
  playerName: string;
  onNavigate: (screen: ScreenId) => void;
  onStarted?: (storyId: string) => void;
  onCompleted: (storyId: string) => void;
}) {
  const [ready, setReady] = useState(false);
  /** HQ_INTRO → ARRIVAL_INTRO here; ARRIVAL_INTRO → BASE_CAMP is handed to the app (onCompleted). */
  const [introState, setIntroState] = useState<Exclude<Chapter3IntroState, "BASE_CAMP">>("HQ_INTRO");
  const urls = useMemo(() => {
    const portraits = Object.values(CHAPTER3_STORY_ACTORS).flatMap((actor) => Object.values(actor.portraits).flatMap((asset) => asset.imageUrl ? [asset.imageUrl] : []));
    return [...new Set([...CHAPTER3_INTRO_IMAGE_URLS, ...portraits])];
  }, []);

  useEffect(() => {
    let alive = true;
    const { width, height } = CHAPTER3_MAP_SIZE;
    Promise.all([
      ...urls.map(preloadImage),
      prepareLoopTile(CHAPTER3_ASSETS.hq.cloudAtmosphere, width, height).catch(() => undefined),
      loadSheetJson(CHAPTER3_ASSETS.vfx.holoGlobeJson).catch(() => undefined),
    ]).then(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [urls]);

  useEffect(() => () => stopAllChapter3Sfx(300), []);

  if (!ready) return <div className="screen-loading chapter3-loading" role="status">작전본부로 이동하는 중입니다.</div>;
  const hq = introState === "HQ_INTRO";
  return (
    <StoryPlayer
      // A new player per state: every timer, step runner, fade and stage effect of the previous map is
      // discarded on the switch, and the arrival map starts from its first step.
      key={introState}
      sequence={hq ? CHAPTER3_INTRO_HQ_SEQUENCE : CHAPTER3_INTRO_ARRIVAL_SEQUENCE}
      playerName={playerName}
      onNavigate={onNavigate}
      onStoryStarted={hq ? () => onStarted?.(CHAPTER3_INTRO_STORY_ID) : undefined}
      onComplete={() => {
        if (hq) {
          // played to the end or skipped: HQ audio (warp charge, BGM) must not leak into the arrival map
          stopAllChapter3Sfx(200);
          void fadeOutBgm(800, "unit3-hq");
          setIntroState("ARRIVAL_INTRO");
        } else {
          onCompleted(CHAPTER3_INTRO_STORY_ID);
        }
      }}
      stageRenderers={STAGE_RENDERERS}
    />
  );
}
