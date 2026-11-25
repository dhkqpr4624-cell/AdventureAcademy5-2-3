export type BaseCampMode = "play" | "story";

export type BaseCampFocusPoint = {
  id: string;
  x: number;
  y: number;
  zoom: number;
  offsetX?: number;
  offsetY?: number;
};

export type BaseCampInteractionRegion = {
  id: "dungeonEntrance" | "questNpc01";
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  markerX?: number;
  markerY?: number;
};

export type BaseCampTramDefinition = {
  src: string;
  /** crop of the visible tram inside the original map-sized layer (keeps the rail height) */
  x: number;
  y: number;
  width: number;
  height: number;
  /** seconds to travel from fully off the right edge to fully off the left edge */
  crossingSeconds: number;
  /** random wait before each appearance (re-rolled before the first and after every pass) */
  intervalSeconds: readonly [number, number];
  /** optional random wait before the FIRST appearance after entering the camp (defaults to intervalSeconds) */
  firstDelaySeconds?: readonly [number, number];
};

/** NPC shown on a base camp map without the Unit 2 quest/dialogue wiring. */
/** Phase 4: looping dungeon entrance — animated region (frame coordinates) cut from the supplied loop sheet. */
export type BaseCampEntranceAnimation = {
  strip: string;
  frames: number;
  fps: number;
  region: { x: number; y: number; w: number; h: number };
};

export type BaseCampNpcView = {
  id: string;
  displayName: string;
  displayRole: string;
  nameTagVariant?: "npc" | "shop";
  placement: { x: number; y: number; width: number; height: number };
  idle: {
    standingImage: string;
    blinkSpriteSheet: string;
    blinkFrameCount: number;
    blinkFrameDurationMs: number;
    minBlinkIntervalMs: number;
    maxBlinkIntervalMs: number;
  };
  mirrored?: boolean;
};

export type BaseCampMapDefinition = {
  id: string;
  worldWidth: number;
  worldHeight: number;
  layers: {
    sky: string;
    background: string;
    ground: string;
    dungeonEntrance: string;
    /** Clickable outline over the entrance. Omit to show the entrance as scenery only. */
    dungeonEntranceButton?: string;
    foreground: string;
  };
  /** Continuously scrolling cloud layer between sky and background. */
  cloudLoop?: { src: string; speed: number };
  /** Tram that crosses the map on the rail (drawn in front of NPCs, behind the ground). */
  tram?: BaseCampTramDefinition;
  /** Phase 4: animated dungeon entrance overlay (the static layer stays as the base). */
  dungeonEntranceAnimation?: BaseCampEntranceAnimation;
  focusPoints: Record<string, BaseCampFocusPoint>;
  interactionRegions: BaseCampInteractionRegion[];
};
