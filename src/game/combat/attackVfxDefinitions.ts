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
 * 의병의 환도 전용 검 swing VFX. Same contract as the other weapon VFX: 8 square frames in one row, 8 fps,
 * played once over 1 s, shown 800×800 pixelated. Rendered with PixelFX (melee/sword-slash, silver palette,
 * no actor) in Phase 3 and packed by scripts/chapter3/pack_pixelfx_sheets.py: 8 cells of 136×136 (1088×136).
 */
export const UIBYEONG_HWANDO_SLASH_VFX = {
  id: "uibyeong-hwando-slash",
  assetFile: "uibyeong-hwando-slash.png",
  sheetWidth: 1088,
  sheetHeight: 136,
  frameWidth: 136,
  frameHeight: 136,
  frameCount: 8,
  fps: 8,
  durationMs: 1000,
  displayWidth: 800,
  displayHeight: 800,
} as const;
