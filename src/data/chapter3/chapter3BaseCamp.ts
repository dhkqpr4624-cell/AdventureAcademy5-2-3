import type { BaseCampMapDefinition, BaseCampNpcView } from "../../types/baseCamp";
import { BASECAMP_TRAM, CHAPTER3_ASSETS, CHAPTER3_MAP_SIZE } from "./chapter3Assets";
import { CHAPTER3_STAGE_SPRITES, STAGE_SPRITE_SCALE, type Chapter3ActorId } from "./chapter3Actors";
import kaidenStanding from "../../assets/story/npcs/chapter3/kaiden/standing_L.png";
import kaidenBlink from "../../assets/story/npcs/chapter3/kaiden/blink_L.png";

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
  tram: { src: CHAPTER3_ASSETS.basecamp.tram, ...BASECAMP_TRAM, crossingSeconds: 12.5,
    // Phase 3 hotfix: shorter, still random gaps so students notice the tram — first pass 4–8 s after entering
    // the camp, then 12–22 s after the car has fully left the screen (a pass itself takes 12.5 s).
    firstDelaySeconds: [4, 8], intervalSeconds: [12, 22] },
  focusPoints: {
    campCenter: { id: "campCenter", x: 836, y: 470.5, zoom: 1 },
  },
  // Phase 2: interactions are Unit 3 hitboxes (see CHAPTER3_BASE_CAMP_HITBOXES), not Unit 2 regions.
  interactionRegions: [],
};

export const CHAPTER3_BASE_CAMP_FOOT_Y = 772;

const idle = (standingImage: string, blinkSpriteSheet = standingImage, blinkFrameCount = 1) => ({
  standingImage, blinkSpriteSheet, blinkFrameCount, blinkFrameDurationMs: 200, minBlinkIntervalMs: 5000, maxBlinkIntervalMs: 10000,
});

function placement(id: Chapter3ActorId, x: number) {
  const sprite = CHAPTER3_STAGE_SPRITES[id];
  // Whole pixels: the blink sheet is positioned in px steps of this width, so a fractional width
  // (600 × 0.3 = 180.00000000000003) would shift the frames by sub-pixels.
  const width = Math.round(sprite.frameWidth * STAGE_SPRITE_SCALE);
  const height = Math.round(sprite.frameHeight * STAGE_SPRITE_SCALE);
  return { x: Math.round(x - sprite.cx * width), y: Math.round(CHAPTER3_BASE_CAMP_FOOT_Y - sprite.foot * height), width, height };
}

/**
 * Supply crates (shop npc.png, 1568x1003; visible pixels 161..1524 x 31..979) standing on the ground line.
 * Phase 2 hotfix: shown 2× larger (scale 0.0844 → 0.1688, ratio kept) and moved slightly right so the
 * visible crates (≈1205–1435) stay clear of Kaiden (visible ≈1059–1171).
 */
const SUPPLY_SCALE = 0.1688;
const SUPPLY_CENTER_X = 1320;
const supplyPlacement = {
  x: Math.round(SUPPLY_CENTER_X - (842 / 1568) * 1568 * SUPPLY_SCALE),
  y: Math.round(CHAPTER3_BASE_CAMP_FOOT_Y - (979 / 1003) * 1003 * SUPPLY_SCALE),
  width: Math.round(1568 * SUPPLY_SCALE),
  height: Math.round(1003 * SUPPLY_SCALE),
};

export type Chapter3CampTargetId = "deneb" | "kaiden" | "supply" | "dungeonEntrance";

/**
 * Click/hover hitboxes in map pixels, fitted to the visible pixels of each sprite (PNG bounding boxes),
 * not to the transparent frame. The dungeon entrance box is the bounding box of the gate layer.
 */
export function createChapter3BaseCampHitboxes(npcs: readonly BaseCampNpcView[]): Record<Chapter3CampTargetId, { x: number; y: number; width: number; height: number }> {
  const box = (id: string, left: number, right: number, top: number, bottom: number) => {
    const placement = npcs.find((npc) => npc.id === id)!.placement;
    return {
      x: placement.x + placement.width * left,
      y: placement.y + placement.height * top,
      width: placement.width * (right - left),
      height: placement.height * (bottom - top),
    };
  };
  return {
    deneb: box("deneb", 0.14, 0.86, 0.054, 0.974),
    kaiden: box("kaiden", 0.2, 0.83, 0.033, 0.959),
    supply: box("supply", 161 / 1568, 1524 / 1568, 31 / 1003, 979 / 1003),
    dungeonEntrance: { x: 629, y: 312, width: 401, height: 457 },
  };
}

/**
 * NPCs at the base camp after the intro: Deneb and Kaiden on either side of the entrance, plus the supply
 * crates ("보급물품") that open the existing shop. The player is the viewer (first person) and is not drawn.
 */
export function createChapter3BaseCampNpcs(): BaseCampNpcView[] {
  return [
    { id: "deneb", displayName: "데네브", displayRole: "지휘관", placement: placement("deneb", 545),
      idle: idle(`${import.meta.env.BASE_URL}assets/npcs/chapter2/deneb/standing_R.png`, `${import.meta.env.BASE_URL}assets/npcs/chapter2/deneb/blink_R.png`, 7) },
    { id: "kaiden", displayName: "카이든", displayRole: "지휘관", placement: placement("kaiden", 1115), idle: idle(kaidenStanding, kaidenBlink, 4) },
    { id: "supply", displayName: "보급물품", displayRole: "상점", nameTagVariant: "shop", placement: supplyPlacement, idle: idle(`${import.meta.env.BASE_URL}assets/chapter3/floor1/shop/supply-crates.png`) },
  ];
}
