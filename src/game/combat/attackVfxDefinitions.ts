export const POWERFUL_IMPACT_VFX = {
  id: "powerful-impact",
  assetFile: "powerful-impact.png",
  sheetWidth: 800,
  sheetHeight: 100,
  frameWidth: 100,
  frameHeight: 100,
  frameCount: 8,
  fps: 8,
  durationMs: 1000,
  displayWidth: 800,
  displayHeight: 800,
} as const;

/**
 * 의병의 환도 전용 검 swing VFX (Phase 2 Hotfix 3). Same sheet contract as the other weapon VFX:
 * 8 frames of 100×100 in one row (800×100, transparent), 8 fps, played once over 1 s, shown 800×800 pixelated.
 * The sheet must be rendered with PixelFX; until it exists the item keeps the default VFX (no attackVfxId).
 */
export const UIBYEONG_HWANDO_SLASH_VFX = {
  id: "uibyeong-hwando-slash",
  assetFile: "uibyeong-hwando-slash.png",
  sheetWidth: 800,
  sheetHeight: 100,
  frameWidth: 100,
  frameHeight: 100,
  frameCount: 8,
  fps: 8,
  durationMs: 1000,
  displayWidth: 800,
  displayHeight: 800,
} as const;
