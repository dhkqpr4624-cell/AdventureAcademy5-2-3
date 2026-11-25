import { UNIT3_FLOOR2_ILLUST, UNIT3_FLOOR2_KAF_STANDING } from "../../data/chapter3/floor2Stories";

/**
 * Illustration stage for the Unit 3 Floor 2 events (rendered by StoryPlayer through stageRenderers).
 * Re-uses the Floor 1 stage styling: every illustration is centred and cross-faded. 카프's period-costume
 * standing illustration is a single image that is always mounted (decoded up front) and only cross-fades
 * opacity, with one fixed size and anchor in every phase — no image swap, so it can never flash or vanish
 * between frames. No blink sheet was supplied, so no blink is played (she is never hidden to fake a blink).
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
  for (const url of UNIT3_FLOOR2_STAGE_IMAGE_URLS) {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    void image.decode?.().catch(() => undefined);
  }
}

export function Unit3Floor2Stage({ phase }: { phase: string }) {
  const spec = UNIT3_FLOOR2_STAGE_PHASES[phase] ?? UNIT3_FLOOR2_STAGE_PHASES.none;
  const visible = spec.layer !== null || spec.kaf;
  return (
    <div className={`u3f1-stage u3f2-stage ${visible ? "is-visible" : ""} ${spec.layer ? "" : "is-standing-only"}`} data-phase={phase} aria-hidden="true">
      <div className="u3f1-stage-frame">
        {LAYERS.map((layer) => (
          <img key={layer} className={`u3f1-stage-illust ${spec.layer === layer ? "is-current" : ""}`} src={UNIT3_FLOOR2_ILLUST[layer]} alt="" draggable={false} />
        ))}
      </div>
      <img className={`u3f2-kaf-standing ${spec.kaf ? "is-shown" : ""}`} src={UNIT3_FLOOR2_KAF_STANDING} alt="" draggable={false} decoding="sync" />
    </div>
  );
}
