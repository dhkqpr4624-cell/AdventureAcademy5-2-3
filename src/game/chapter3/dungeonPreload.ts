import { getItemDefinition } from "../inventory/itemDefinitions";

/**
 * Phase 3 hotfix: base-camp preloading of what a dungeon entry needs, in priority order —
 *   1. the dungeon screen code chunk (lazy-loaded by App),
 *   2. the Gyeongseong street assets (building meshes + textures, road tiles; parsed once and cached for the
 *      session by GyeongseongEnvironment),
 *   3. the monster images of the floors that can currently be entered,
 *   4. the equipped weapon's attack VFX sheet,
 *   5. the story illustrations of floors whose story is still running (download only — decoded at entry).
 *      Before, Floor 2 started downloading ~15 MB of illustrations at the moment of entry, competing with the
 *      street models for bandwidth.
 * It starts a few seconds after the camp is shown and only runs in idle time, one asset at a time, so NPC talk,
 * the shop and popups stay responsive. Nothing is preloaded on the title screen or during the intro.
 * Everything goes through the normal browser / module caches, so a later dungeon entry simply finds it ready;
 * leaving the camp stops scheduling (in-flight loads finish and stay cached).
 */
const WEAPON_VFX_FILES: Readonly<Record<string, string>> = {
  "fire-attack": "fire-attack.png",
  "water-thunderbolt": "water-blade-slash.png",
  "ink-brush-attack": "ink-brush-attack.png",
  "powerful-impact": "powerful-impact.png",
  "uibyeong-hwando-slash": "uibyeong-hwando-slash.png",
};
const UNIT3_FLOOR_MONSTERS: Readonly<Record<string, readonly string[]>> = {
  "unit3-floor-1": ["unit3-inked-treaty-document", "unit3-informant-shadow", "unit3-residency-general-watcher"],
  "unit3-floor-2": ["unit3-f2-sycophant", "unit3-f2-informing-shadow", "unit3-f2-ito-phantom"],
  "unit3-floor-3": ["unit3-f3-kenpei", "unit3-f3-governor-watcher"],
};
const preloadedImages = new Set<string>();

function preloadImage(url: string, decode = true): Promise<void> {
  if (preloadedImages.has(url) || typeof Image === "undefined") return Promise.resolve();
  preloadedImages.add(url);
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => { if (!decode) { resolve(); return; } void (image.decode?.() ?? Promise.resolve()).catch(() => undefined).finally(resolve); };
    image.onerror = () => { preloadedImages.delete(url); resolve(); };
    image.src = url;
  });
}

const whenIdle = () => new Promise<void>((resolve) => {
  const idle = (window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(() => resolve(), { timeout: 1500 }); else window.setTimeout(resolve, 200);
});

/** Starts the preload after `delayMs`; returns a cancel function (call it when leaving the base camp). */
export function scheduleUnit3DungeonPreload(enterableFloorIds: readonly string[], equippedWeaponSkinId: string | null, storyFloorIds: readonly string[] = [], delayMs = 2500): () => void {
  let cancelled = false;
  const timer = window.setTimeout(() => { void run(); }, delayMs);
  const run = async () => {
    const steps: (() => Promise<unknown>)[] = [
      () => import("../../screens/DungeonScreen/DungeonScreen"),
      () => import("../../three/dungeon/gyeongseong/GyeongseongEnvironment").then((module) => module.preloadGyeongseongAssets()),
      () => import("../monster/monsterDefinitions").then(async ({ getMonsterVisualDefinition }) => {
        for (const floorId of enterableFloorIds) {
          for (const monsterId of UNIT3_FLOOR_MONSTERS[floorId] ?? []) {
            if (cancelled) return;
            try { await preloadImage(getMonsterVisualDefinition(monsterId).image); } catch { /* unknown id: skip */ }
          }
        }
      }),
      async () => {
        const weapon = equippedWeaponSkinId ? getItemDefinition(equippedWeaponSkinId) : null;
        const file = weapon?.type === "weaponSkin" ? WEAPON_VFX_FILES[weapon.attackVfxId ?? "fire-attack"] : undefined;
        if (file) await preloadImage(`${import.meta.env.BASE_URL}assets/combat/vfx/${file}`);
      },
      async () => {
        const urls: string[] = [];
        if (storyFloorIds.includes("unit3-floor-1")) urls.push(...(await import("./Unit3Floor1Stage")).UNIT3_FLOOR1_STAGE_IMAGE_URLS);
        if (storyFloorIds.includes("unit3-floor-2")) urls.push(...(await import("./Unit3Floor2Stage")).UNIT3_FLOOR2_STAGE_IMAGE_URLS);
        // Phase 4: Floor 3 story illustrations + every event-map layer, standing and VFX sheet (download only).
        if (storyFloorIds.includes("unit3-floor-3")) {
          urls.push(...(await import("./Unit3Floor3Stage")).UNIT3_FLOOR3_STAGE_IMAGE_URLS);
          urls.push(...(await import("./eventMap/Unit3Floor3EventMap")).U3EM_IMAGE_URLS);
        }
        for (const url of urls) {
          if (cancelled) return;
          await whenIdle();
          await preloadImage(url, false);
        }
      },
    ];
    for (const step of steps) {
      if (cancelled) return;
      await whenIdle();
      if (cancelled) return;
      await step().catch(() => undefined);
    }
  };
  return () => { cancelled = true; window.clearTimeout(timer); };
}
