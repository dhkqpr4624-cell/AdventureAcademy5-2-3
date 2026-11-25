import { useRef } from "react";
import { UNIT3_FLOOR2_ILLUST, UNIT3_FLOOR2_KAF_STANDING, UNIT3_FLOOR2_PORTRAIT_URLS } from "../../data/chapter3/floor2Stories";

/**
 * Illustration stage for the Unit 3 Floor 2 events (rendered by StoryPlayer through stageRenderers).
 * Re-uses the Floor 1 stage styling: every illustration is centred and cross-faded. 카프's period-costume
 * standing illustration is a single image that is always mounted (decoded up front) and only cross-fades
 * opacity, with one fixed size and anchor in every phase — no image swap, so it can never flash or vanish
 * between frames. No blink sheet was supplied, so no blink is played (she is never hidden to fake a blink).
 *
 * Phase 3 hotfix: where she stands depends on whether a story illustration is behind her. Beside an
 * illustration (street-kaf, yard-kaf) she keeps her place right of centre; alone (kaf) her horizontal centre is
 * the screen centre. The placement is taken from the last phase in which she was shown, so while she fades
 * out (e.g. street-kaf → none) she never slides to the other position.
 */
type Layer = keyof typeof UNIT3_FLOOR2_ILLUST;
type PhaseSpec = { layer: Layer | null; kaf: boolean };

export const UNIT3_FLOOR2_STAGE_PHASES: Record<string, PhaseSpec> = {
  none: { layer: null, kaf: false },
  street: { layer: "street", kaf: false },
  "street-kaf": { layer: "street", kaf: true },
  backstreet: { layer: "backstreet", kaf: false },
  kaf: { layer: null, kaf: true },
  classroom: { layer: "classroom", kaf: false },
  fundraising: { layer: "fundraising", kaf: false },
  harbin: { layer: "harbin", kaf: false },
  yard: { layer: "yard", kaf: false },
  "yard-kaf": { layer: "yard", kaf: true },
};

const LAYERS = Object.keys(UNIT3_FLOOR2_ILLUST) as Layer[];
export const UNIT3_FLOOR2_STAGE_IMAGE_URLS: string[] = [...Object.values(UNIT3_FLOOR2_ILLUST), UNIT3_FLOOR2_KAF_STANDING];

/** Decode every stage image once (called when a Floor 2 run starts) so no layer appears late or blank. */
export function preloadUnit3Floor2StageImages(): void {
  if (typeof Image === "undefined") return;
  for (const url of [...UNIT3_FLOOR2_STAGE_IMAGE_URLS, ...UNIT3_FLOOR2_PORTRAIT_URLS]) {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    void image.decode?.().catch(() => undefined);
  }
}

export type KafPlacement = "beside" | "solo";
/** Phase 3 hotfix: alone (no illustration) → centred; beside an illustration → right of centre; hidden → keep the last place. */
export function resolveKafPlacement(phase: string, previous: KafPlacement): KafPlacement {
  const spec = UNIT3_FLOOR2_STAGE_PHASES[phase] ?? UNIT3_FLOOR2_STAGE_PHASES.none;
  if (!spec.kaf) return previous;
  return spec.layer ? "beside" : "solo";
}

export function Unit3Floor2Stage({ phase }: { phase: string }) {
  const spec = UNIT3_FLOOR2_STAGE_PHASES[phase] ?? UNIT3_FLOOR2_STAGE_PHASES.none;
  const visible = spec.layer !== null || spec.kaf;
  const kafPlacementRef = useRef<KafPlacement>("beside");
  kafPlacementRef.current = resolveKafPlacement(phase, kafPlacementRef.current);
  return (
    <div className={`u3f1-stage u3f2-stage ${visible ? "is-visible" : ""} ${spec.layer ? "" : "is-standing-only"}`} data-phase={phase} aria-hidden="true">
      <div className="u3f1-stage-frame">
        {LAYERS.map((layer) => (
          <img key={layer} className={`u3f1-stage-illust ${spec.layer === layer ? "is-current" : ""}`} src={UNIT3_FLOOR2_ILLUST[layer]} alt="" draggable={false} />
        ))}
      </div>
      <img className={`u3f2-kaf-standing is-${kafPlacementRef.current} ${spec.kaf ? "is-shown" : ""}`} src={UNIT3_FLOOR2_KAF_STANDING} alt="" draggable={false} decoding="sync" />
    </div>
  );
}
