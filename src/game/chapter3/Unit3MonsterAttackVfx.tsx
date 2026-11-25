import { useEffect } from "react";
import { UNIT3_MONSTER_IDS } from "./unit3Floor1";
import { UNIT3_FLOOR2_MONSTER_IDS } from "./unit3Floor2";
import { UNIT3_FLOOR3_MONSTER_IDS } from "./unit3Floor3";

/**
 * Unit 3 monster VFX: 8-frame one-shot strips played over the combat view.
 * - Floor 1 attack sheets: scripts/chapter3/make_floor1_monster_vfx.py (Phase 2).
 * - Floor 2 attack + defeat sheets and Floor 3 attack sheets (Phase 4): rendered with PixelFX and packed by scripts/chapter3/pack_pixelfx_sheets.py
 *   (Phase 3); each PNG has a JSON sidecar with the PixelFX effect, options and frames used.
 * Attack VFX start right before the existing monster "attack" animation; combat logic, damage and the timing
 * of the hit are unchanged. The defeat smoke plays alongside the existing "defeat" animation.
 */
const base = `${import.meta.env.BASE_URL}assets/chapter3`;
const VFX_BY_MONSTER: Record<string, string> = {
  [UNIT3_MONSTER_IDS.normalA]: "floor1/vfx/ink-splash",
  [UNIT3_MONSTER_IDS.normalB]: "floor1/vfx/shadow-lantern",
  [UNIT3_MONSTER_IDS.elite]: "floor1/vfx/sabre-slash",
  [UNIT3_FLOOR2_MONSTER_IDS.sycophant]: "floor2/vfx/sycophant-dark-burst",
  [UNIT3_FLOOR2_MONSTER_IDS.informer]: "floor2/vfx/informer-shadow-fog",
  [UNIT3_FLOOR2_MONSTER_IDS.elite]: "floor2/vfx/ito-phantom-dark-blast",
  // Phase 4 (Floor 3): PixelFX melee/double-slash (steel / khaki) and shadow/hex-sigil (cold watching sigil)
  [UNIT3_FLOOR3_MONSTER_IDS.kenpei]: "floor3/vfx/kenpei-saber-slash",
  [UNIT3_FLOOR3_MONSTER_IDS.watcher]: "floor3/vfx/watcher-surveillance-sigil",
};
/** 처치 연출: 아부쟁이 친일파 scatters into black smoke (no suitable existing smoke VFX existed). */
const DEFEAT_VFX_BY_MONSTER: Record<string, string> = {
  [UNIT3_FLOOR2_MONSTER_IDS.sycophant]: "floor2/vfx/sycophant-black-smoke",
};
export const UNIT3_MONSTER_ATTACK_VFX_MS = 640;
/** The monster's own attack animation starts this long after the VFX begins. */
export const UNIT3_MONSTER_ATTACK_LEAD_MS = 220;

export function getUnit3MonsterAttackVfx(monsterId: string): string | null {
  return VFX_BY_MONSTER[monsterId] ?? null;
}

export function getUnit3MonsterDefeatVfx(monsterId: string): string | null {
  return DEFEAT_VFX_BY_MONSTER[monsterId] ?? null;
}

export function Unit3MonsterAttackVfx({ vfxId, onDone }: { vfxId: string; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, UNIT3_MONSTER_ATTACK_VFX_MS + 60);
    return () => window.clearTimeout(timer);
  }, [onDone]);
  const name = vfxId.split("/").pop();
  return (
    <div
      className={`unit3-monster-vfx vfx-${name}`}
      data-vfx={vfxId}
      style={{ backgroundImage: `url(${base}/${vfxId}.png)`, animationDuration: `${UNIT3_MONSTER_ATTACK_VFX_MS}ms` }}
      aria-hidden="true"
    />
  );
}
