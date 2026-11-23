import { UNIT3_FLOOR1_ILLUST } from "../../data/chapter3/floor1Stories";

/**
 * Illustration stage for the Unit 3 Floor 1 events (rendered by StoryPlayer through stageRenderers).
 * Every illustration is centred and cross-faded; the final alley adds a fog layer that thins once the
 * name on the access card is revealed, and the card itself cross-fades hidden → revealed with a soft glow.
 */
type Layer = "street" | "cart" | "newspaper" | "militia" | "soldier" | "alley";
type PhaseSpec = { layer: Layer | null; card: "hidden" | "revealed" | null; fog: number };

export const UNIT3_FLOOR1_STAGE_PHASES: Record<string, PhaseSpec> = {
  none: { layer: null, card: null, fog: 0 },
  street: { layer: "street", card: null, fog: 0 },
  cart: { layer: "cart", card: null, fog: 0 },
  "card-hidden": { layer: null, card: "hidden", fog: 0 },
  newspaper: { layer: "newspaper", card: null, fog: 0 },
  militia: { layer: "militia", card: null, fog: 0 },
  soldier: { layer: "soldier", card: null, fog: 0 },
  alley: { layer: "alley", card: null, fog: 0.62 },
  "alley-card-hidden": { layer: "alley", card: "hidden", fog: 0.62 },
  "alley-card-revealed": { layer: "alley", card: "revealed", fog: 0.44 },
  "alley-clear": { layer: "alley", card: null, fog: 0.44 },
};

const LAYERS: Layer[] = ["street", "cart", "newspaper", "militia", "soldier", "alley"];

export const UNIT3_FLOOR1_STAGE_IMAGE_URLS: string[] = Object.values(UNIT3_FLOOR1_ILLUST);

export function Unit3Floor1Stage({ phase }: { phase: string }) {
  const spec = UNIT3_FLOOR1_STAGE_PHASES[phase] ?? UNIT3_FLOOR1_STAGE_PHASES.none;
  const visible = spec.layer !== null || spec.card !== null;
  return (
    <div className={`u3f1-stage ${visible ? "is-visible" : ""}`} data-phase={phase} aria-hidden="true">
      <div className="u3f1-stage-frame">
        {LAYERS.map((layer) => (
          <img key={layer} className={`u3f1-stage-illust ${spec.layer === layer ? "is-current" : ""}`} src={UNIT3_FLOOR1_ILLUST[layer]} alt="" draggable={false} />
        ))}
        <div className="u3f1-stage-fog" style={{ opacity: spec.layer === "alley" ? spec.fog : 0 }} />
      </div>
      <div className={`u3f1-stage-card ${spec.card ? "is-shown" : ""} ${spec.card === "revealed" ? "is-revealed" : ""}`}>
        <img className="u3f1-card-hidden" src={UNIT3_FLOOR1_ILLUST.cardHidden} alt="" draggable={false} />
        <img className="u3f1-card-revealed" src={UNIT3_FLOOR1_ILLUST.cardRevealed} alt="" draggable={false} />
      </div>
    </div>
  );
}
