import type { BaseCampMapDefinition, BaseCampNpcView } from "../../types/baseCamp";
import { BASECAMP_TRAM, CHAPTER3_ASSETS, CHAPTER3_MAP_SIZE } from "./chapter3Assets";
import { CHAPTER3_STAGE_SPRITES, STAGE_SPRITE_SCALE, type Chapter3ActorId } from "./chapter3Actors";
import kaidenStanding from "../../assets/npcs/kaiden/kaiden_standing.png";
import kaidenBlink from "../../assets/npcs/kaiden/kaiden_blink.png";

/**
 * Unit 3 base camp (arrival only in Phase 1). Layer order:
 * sky → cloud (loop) → background → foreground → dungeon entrance (scenery, not clickable) → NPC → tram → ground.
 */
export const CHAPTER3_BASE_CAMP_MAP: BaseCampMapDefinition = {
  id: "chapter3-base-camp",
  worldWidth: CHAPTER3_MAP_SIZE.width,
  worldHeight: CHAPTER3_MAP_SIZE.height,
  layers: {
    sky: CHAPTER3_ASSETS.sky,
    background: CHAPTER3_ASSETS.basecamp.background,
    foreground: CHAPTER3_ASSETS.basecamp.foreground,
    dungeonEntrance: CHAPTER3_ASSETS.basecamp.dungeonEntrance,
    ground: CHAPTER3_ASSETS.basecamp.ground,
  },
  cloudLoop: { src: CHAPTER3_ASSETS.basecamp.cloud, speed: 12 },
  tram: { src: CHAPTER3_ASSETS.basecamp.tram, ...BASECAMP_TRAM, crossingSeconds: 12.5, intervalSeconds: [30, 60] },
  focusPoints: {
    campCenter: { id: "campCenter", x: 836, y: 470.5, zoom: 1 },
  },
  // Phase 1: no dungeon entry, quests or shop — the entrance is scenery only.
  interactionRegions: [],
};

export const CHAPTER3_BASE_CAMP_FOOT_Y = 772;

const idle = (standingImage: string, blinkSpriteSheet = standingImage, blinkFrameCount = 1) => ({
  standingImage, blinkSpriteSheet, blinkFrameCount, blinkFrameDurationMs: 200, minBlinkIntervalMs: 5000, maxBlinkIntervalMs: 10000,
});

function placement(id: Chapter3ActorId, x: number) {
  const sprite = CHAPTER3_STAGE_SPRITES[id];
  const width = sprite.frameWidth * STAGE_SPRITE_SCALE;
  const height = sprite.frameHeight * STAGE_SPRITE_SCALE;
  return { x: x - sprite.cx * width, y: CHAPTER3_BASE_CAMP_FOOT_Y - sprite.foot * height, width, height };
}

/** Party at the base camp after the intro: player, Deneb, Kaiden only. */
export function createChapter3BaseCampNpcs(playerName: string): BaseCampNpcView[] {
  return [
    { id: "deneb", displayName: "데네브", displayRole: "지휘관", placement: placement("deneb", 470),
      idle: idle(`${import.meta.env.BASE_URL}assets/npcs/chapter2/deneb/standing_R.png`, `${import.meta.env.BASE_URL}assets/npcs/chapter2/deneb/blink_R.png`, 7) },
    { id: "player", displayName: playerName || "플레이어", displayRole: "원정대원", placement: placement("player", 1170), idle: idle(CHAPTER3_ASSETS.actors.player) },
    { id: "kaiden", displayName: "카이든", displayRole: "지휘관", placement: placement("kaiden", 1290), idle: idle(kaidenStanding, kaidenBlink, 7) },
  ];
}
