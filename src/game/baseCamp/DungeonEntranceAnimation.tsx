import type { CSSProperties } from "react";
import type { BaseCampEntranceAnimation } from "../../types/baseCamp";

/**
 * Phase 4: looping dungeon entrance (supplied 12-frame portal sheet, 8 fps, 1.5 s loop).
 *
 * The supplied frames are 1672×941 like the static entrance PNG, and outside the portal / lantern masks every
 * frame is identical to that PNG (checked: 0 differing pixels in all 12 frames). So the static PNG stays as the
 * base (and fallback), and only the animated pixels — a 338×199 region at (661, 551), cut out in frame
 * coordinates — loop on top. Pure CSS: a `steps(12)` transform animation of one strip image (no React state, no
 * per-frame requests or texture uploads; about 3 MB of GPU memory instead of ~75 MB for the full sheet). Removed
 * with the base camp; the outline and click area are unchanged (the silhouette never changes).
 */
export function DungeonEntranceAnimation({ animation, worldWidth, worldHeight }: { animation: BaseCampEntranceAnimation; worldWidth: number; worldHeight: number }) {
  const { region, frames, fps, strip } = animation;
  const style = {
    left: `${(region.x / worldWidth) * 100}%`, top: `${(region.y / worldHeight) * 100}%`,
    width: `${(region.w / worldWidth) * 100}%`, height: `${(region.h / worldHeight) * 100}%`,
    "--entrance-frames": frames, "--entrance-duration": `${frames / fps}s`,
  } as CSSProperties;
  return (
    <span className="dungeon-entrance-animation" style={style} aria-hidden="true">
      <img src={strip} alt="" draggable={false} style={{ width: `${frames * 100}%` }} />
    </span>
  );
}
