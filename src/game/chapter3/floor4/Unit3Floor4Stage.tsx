import { useEffect, useRef } from "react";
import { UNIT3_FLOOR4_ILLUST } from "../../../data/chapter3/floor4Stories";
import { CHAPTER3_STAGE_SPRITES } from "../../../data/chapter3/chapter3Actors";
import kappStandingR from "../../../assets/story/npcs/chapter2/kapp/standing_R.png";

/**
 * Floor 4 illustration stage (탑골공원 · 상하이) — the Floor 1–3 stage styling: centred illustration that
 * cross-fades; 카프's standing (her own outfit — she has her memory back) is always mounted and only fades.
 * Placement rule (Phase 3 hotfix): beside the illustration → right of centre.
 */
export const UNIT3_FLOOR4_STAGE_PHASES: Record<string, { layer: keyof typeof UNIT3_FLOOR4_ILLUST | null; kaf: boolean }> = {
  none: { layer: null, kaf: false },
  tapgol: { layer: "tapgol", kaf: false },
  "tapgol-kaf": { layer: "tapgol", kaf: true },
  shanghai: { layer: "shanghai", kaf: false },
};
export const UNIT3_FLOOR4_KAF_STANDING = kappStandingR;
export const UNIT3_FLOOR4_STAGE_IMAGE_URLS: string[] = [...Object.values(UNIT3_FLOOR4_ILLUST), kappStandingR, CHAPTER3_STAGE_SPRITES.kaiden.images.L!];

export function Unit3Floor4Stage({ phase }: { phase: string }) {
  const spec = UNIT3_FLOOR4_STAGE_PHASES[phase] ?? UNIT3_FLOOR4_STAGE_PHASES.none;
  return (
    <div className={`u3f1-stage u4-stage ${spec.layer ? "is-visible" : ""}`} data-phase={phase} aria-hidden="true">
      <div className="u3f1-stage-frame">
        {(Object.keys(UNIT3_FLOOR4_ILLUST) as (keyof typeof UNIT3_FLOOR4_ILLUST)[]).map((layer) => (
          <img key={layer} className={`u3f1-stage-illust ${spec.layer === layer ? "is-current" : ""}`} src={UNIT3_FLOOR4_ILLUST[layer]} alt="" draggable={false} />
        ))}
      </div>
      <img className={`u4-kaf-standing ${spec.kaf ? "is-shown" : ""}`} src={kappStandingR} alt="" draggable={false} decoding="sync" />
    </div>
  );
}

/**
 * Date / place caption: a small translucent black box at the bottom left, typed one character at a time
 * (textContent written directly — no React state per character). `holdMs` > 0: kept that long after it is
 * complete, then faded out; 0: stays until `text` changes to null.
 */
export function Unit3Floor4Caption({ text, holdMs = 2000 }: { text: string | null; holdMs?: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const box = boxRef.current, span = textRef.current;
    if (!box || !span) return;
    if (!text) { box.classList.remove("is-shown"); return; }
    span.textContent = "";
    box.classList.add("is-shown");
    const chars = [...text];
    let index = 0;
    let hold: number | null = null;
    const timer = window.setInterval(() => {
      index += 1;
      span.textContent = chars.slice(0, index).join("");
      if (index >= chars.length) {
        window.clearInterval(timer);
        if (holdMs > 0) hold = window.setTimeout(() => box.classList.remove("is-shown"), holdMs);
      }
    }, 70);
    return () => { window.clearInterval(timer); if (hold !== null) window.clearTimeout(hold); };
  }, [text, holdMs]);
  return <div ref={boxRef} className="u4-caption" aria-live="polite" data-testid="u4-caption"><span ref={textRef} /></div>;
}
