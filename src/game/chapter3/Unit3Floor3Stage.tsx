import { useRef } from "react";
import { UNIT3_FLOOR3_ILLUST, UNIT3_FLOOR3_KAF_STANDING, UNIT3_FLOOR3_PORTRAIT_URLS } from "../../data/chapter3/floor3Stories";
import type { KafPlacement } from "./Unit3Floor2Stage";

/**
 * Illustration stage for the Unit 3 Floor 3 story rooms — the Floor 2 stage styling and rules: illustrations
 * are centred and cross-faded; 카프's period-costume standing is always mounted and only fades opacity.
 * 카프 placement (Phase 3 hotfix rule): beside an illustration → right of centre, alone → screen centre,
 * fading out → keeps the last placement.
 */
type Layer = keyof typeof UNIT3_FLOOR3_ILLUST;
type PhaseSpec = { layer: Layer | null; kaf: boolean };

export const UNIT3_FLOOR3_STAGE_PHASES: Record<string, PhaseSpec> = {
  none: { layer: null, kaf: false },
  street: { layer: "street", kaf: false },
  "street-kaf": { layer: "street", kaf: true },
  kaf: { layer: null, kaf: true },
  government: { layer: "government", kaf: false },
  alley: { layer: "alley", kaf: false },
  farmers: { layer: "farmers", kaf: false },
  classroom: { layer: "classroom", kaf: false },
};

const LAYERS = Object.keys(UNIT3_FLOOR3_ILLUST) as Layer[];
export const UNIT3_FLOOR3_STAGE_IMAGE_URLS: string[] = [...Object.values(UNIT3_FLOOR3_ILLUST), UNIT3_FLOOR3_KAF_STANDING];

export function resolveFloor3KafPlacement(phase: string, previous: KafPlacement): KafPlacement {
  const spec = UNIT3_FLOOR3_STAGE_PHASES[phase] ?? UNIT3_FLOOR3_STAGE_PHASES.none;
  if (!spec.kaf) return previous;
  return spec.layer ? "beside" : "solo";
}

export function preloadImages(urls: readonly string[]): void {
  if (typeof Image === "undefined") return;
  for (const url of urls) {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    void image.decode?.().catch(() => undefined);
  }
}

export function Unit3Floor3Stage({ phase }: { phase: string }) {
  const spec = UNIT3_FLOOR3_STAGE_PHASES[phase] ?? UNIT3_FLOOR3_STAGE_PHASES.none;
  const visible = spec.layer !== null || spec.kaf;
  const kafPlacementRef = useRef<KafPlacement>("beside");
  kafPlacementRef.current = resolveFloor3KafPlacement(phase, kafPlacementRef.current);
  return (
    <div className={`u3f1-stage u3f2-stage u3f3-stage ${visible ? "is-visible" : ""} ${spec.layer ? "" : "is-standing-only"}`} data-phase={phase} aria-hidden="true">
      <div className="u3f1-stage-frame">
        {LAYERS.map((layer) => (
          <img key={layer} className={`u3f1-stage-illust ${spec.layer === layer ? "is-current" : ""}`} src={UNIT3_FLOOR3_ILLUST[layer]} alt="" draggable={false} />
        ))}
      </div>
      <img className={`u3f2-kaf-standing is-${kafPlacementRef.current} ${spec.kaf ? "is-shown" : ""}`} src={UNIT3_FLOOR3_KAF_STANDING} alt="" draggable={false} decoding="sync" />
    </div>
  );
}

export { UNIT3_FLOOR3_PORTRAIT_URLS };
