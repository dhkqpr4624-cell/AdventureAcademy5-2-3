import { useEffect } from "react";
import { UNIT3_MONSTER_IDS } from "./unit3Floor1";

/**
 * Unit 3 Floor 1 monster attack VFX (8-frame sheets from scripts/chapter3/make_floor1_monster_vfx.py).
 * Played over the combat view right before the existing monster "attack" animation; combat logic,
 * damage and timing of the hit are unchanged.
 */
const VFX_BY_MONSTER: Record<string, string> = {
  [UNIT3_MONSTER_IDS.normalA]: "ink-splash",
  [UNIT3_MONSTER_IDS.normalB]: "shadow-lantern",
  [UNIT3_MONSTER_IDS.elite]: "sabre-slash",
};
export const UNIT3_MONSTER_ATTACK_VFX_MS = 640;
/** The monster's own attack animation starts this long after the VFX begins. */
export const UNIT3_MONSTER_ATTACK_LEAD_MS = 220;

export function getUnit3MonsterAttackVfx(monsterId: string): string | null {
  return VFX_BY_MONSTER[monsterId] ?? null;
}

export function Unit3MonsterAttackVfx({ vfxId, onDone }: { vfxId: string; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, UNIT3_MONSTER_ATTACK_VFX_MS + 60);
    return () => window.clearTimeout(timer);
  }, [onDone]);
  return (
    <div
      className={`unit3-monster-vfx vfx-${vfxId}`}
      style={{ backgroundImage: `url(${import.meta.env.BASE_URL}assets/chapter3/floor1/vfx/${vfxId}.png)`, animationDuration: `${UNIT3_MONSTER_ATTACK_VFX_MS}ms` }}
      aria-hidden="true"
    />
  );
}
