import type { StoryActor, StoryVisualAsset } from "../../types/story";
import { createChapter2Actor } from "../stories/chapter2Portraits";
import lunaL from "../../assets/story/npcs/chapter3/luna/standing_L.png";
import lunaR from "../../assets/story/npcs/chapter3/luna/standing_R.png";
import lunaBlinkL from "../../assets/story/npcs/chapter3/luna/blink_L.png";
import lunaBlinkR from "../../assets/story/npcs/chapter3/luna/blink_R.png";
import theoL from "../../assets/story/npcs/chapter3/theo/standing_L.png";
import theoR from "../../assets/story/npcs/chapter3/theo/standing_R.png";
import theoBlinkL from "../../assets/story/npcs/chapter3/theo/blink_L.png";
import theoBlinkR from "../../assets/story/npcs/chapter3/theo/blink_R.png";
import aronL from "../../assets/story/npcs/chapter2/aron/standing_L.png";
import aronR from "../../assets/story/npcs/chapter2/aron/standing_R.png";
import kappL from "../../assets/story/npcs/chapter2/kapp/standing_L.png";
import kappR from "../../assets/story/npcs/chapter2/kapp/standing_R.png";
import researcherL from "../../assets/story/npcs/chapter2/researcher/standing_L.png";
import kaidenL from "../../assets/story/npcs/chapter3/kaiden/standing_L.png";
import kaidenR from "../../assets/story/npcs/chapter3/kaiden/standing_R.png";
import kaidenBlinkL from "../../assets/story/npcs/chapter3/kaiden/blink_L.png";
import kaidenBlinkR from "../../assets/story/npcs/chapter3/kaiden/blink_R.png";
import kaidenDefault from "../../assets/portraits/chapter3/kaiden/default.png";
import kaidenSmile from "../../assets/portraits/chapter3/kaiden/smile.png";
import kaidenAngry from "../../assets/portraits/chapter3/kaiden/angry.png";
import kaidenShout from "../../assets/portraits/chapter3/kaiden/shout.png";
import kaidenShame from "../../assets/portraits/chapter3/kaiden/shame.png";

/** Visible story NPCs. The player is the viewer (first person) and is never drawn on a map. */
export type Chapter3ActorId = "theo" | "luna" | "aron" | "kapp" | "deneb" | "kaiden" | "researcher";
export type Facing = "L" | "R";

/**
 * Map sprite definition. All story sprites share one pixel scale (0.3 map px per source px), so the
 * 380x600 and 400x700 frames keep their relative heights. `foot` is the bottom of the visible pixels
 * (from the PNG bounding box) as a fraction of the frame height; `cx` the horizontal centre.
 */
export type StageSprite = {
  frameWidth: number;
  frameHeight: number;
  foot: number;
  cx: number;
  /** top of the visible pixels (head) as a fraction of the frame height */
  head: number;
  /** Image per facing. A missing facing is drawn by mirroring the other one. */
  images: Partial<Record<Facing, string>>;
  walk?: { images: Record<Facing, string>; frames: number; fps: number };
  /** Horizontal blink sheet (frame 0 = standing). Played at random intervals while idle. */
  blink?: { images: Record<Facing, string>; frames: number; frameMs: number };
};

export const STAGE_SPRITE_SCALE = 0.3;

const deneb = `${import.meta.env.BASE_URL}assets/npcs/chapter2/deneb/standing_R.png`;

export const CHAPTER3_STAGE_SPRITES: Record<Chapter3ActorId, StageSprite> = {
  // Phase 2: Theo, Luna and Kaiden use the supplied 600x700 standing frames and 4-frame blink sheets
  // (foot/cx/head measured from the PNG bounding boxes). No walk sheet exists for the new designs:
  // PixelFX generation was not available in this environment, so moves glide the standing frame.
  theo: { frameWidth: 600, frameHeight: 700, foot: 0.95, cx: 0.5, head: 0.146, images: { L: theoL, R: theoR }, blink: { images: { L: theoBlinkL, R: theoBlinkR }, frames: 4, frameMs: 90 } },
  luna: { frameWidth: 600, frameHeight: 700, foot: 0.953, cx: 0.5, head: 0.073, images: { L: lunaL, R: lunaR }, blink: { images: { L: lunaBlinkL, R: lunaBlinkR }, frames: 4, frameMs: 90 } },
  aron: { frameWidth: 400, frameHeight: 700, foot: 0.9814, cx: 0.525, head: 0.137, images: { L: aronL, R: aronR } },
  kapp: { frameWidth: 400, frameHeight: 700, foot: 0.9729, cx: 0.5, head: 0.189, images: { L: kappL, R: kappR } },
  deneb: { frameWidth: 400, frameHeight: 700, foot: 0.9743, cx: 0.499, head: 0.054, images: { R: deneb } },
  kaiden: {
    frameWidth: 600, frameHeight: 700, foot: 0.959, cx: 0.5, head: 0.033,
    images: { L: kaidenL, R: kaidenR },
    blink: { images: { L: kaidenBlinkL, R: kaidenBlinkR }, frames: 4, frameMs: 90 },
  },
  researcher: { frameWidth: 400, frameHeight: 700, foot: 0.99, cx: 0.479, head: 0.157, images: { L: researcherL } },
};

const kaidenPortrait = (imageUrl: string): StoryVisualAsset => ({
  imageUrl,
  placeholder: { label: "카이든", subtitle: "지휘관", gradient: "linear-gradient(135deg, #2b2233, #111)" },
});

/**
 * Dialogue actors. Requested expressions that do not exist fall back to the closest existing one:
 * kaiden/serious → default, deneb/serious → default, researcher/serious → default (only portrait).
 */
const withAlias = (actor: StoryActor, aliases: Record<string, string>): StoryActor => ({
  ...actor,
  portraits: {
    ...actor.portraits,
    ...Object.fromEntries(Object.entries(aliases).flatMap(([alias, target]) =>
      actor.portraits[target] && !actor.portraits[alias] ? [[alias, actor.portraits[target]]] : [])),
  },
});

export const CHAPTER3_STORY_ACTORS: Record<string, StoryActor> = {
  luna: createChapter2Actor("luna", "루나", "정찰 담당", "#ff8b72"),
  theo: createChapter2Actor("theo", "테오", "보급 담당", "#7fc8ff"),
  aron: createChapter2Actor("aron", "아론", "정예 요원", "#d9b6ff"),
  kapp: createChapter2Actor("kapp", "카프", "정예 요원", "#ffcf80"),
  deneb: { ...withAlias(createChapter2Actor("deneb", "데네브", "지휘관", "#f3dc9a"), { serious: "default" }), displayRole: "지휘관" },
  researcher: withAlias(createChapter2Actor("researcher", "연구원", "본부 연구원", "#d8e4ec"), { serious: "default" }),
  kaiden: {
    id: "kaiden",
    name: "카이든",
    role: "지휘관",
    displayRole: "지휘관",
    accentColor: "#c7a6ff",
    defaultExpression: "default",
    portraits: {
      default: kaidenPortrait(kaidenDefault),
      smile: kaidenPortrait(kaidenSmile),
      angry: kaidenPortrait(kaidenAngry),
      shout: kaidenPortrait(kaidenShout),
      shame: kaidenPortrait(kaidenShame),
      serious: kaidenPortrait(kaidenDefault),
    },
  },
};

/** Requested → used expression, for the report and for checks. */
export const CHAPTER3_EXPRESSION_FALLBACKS = [
  { actor: "kaiden", requested: "serious", used: "default" },
  { actor: "deneb", requested: "serious", used: "default" },
  { actor: "researcher", requested: "serious", used: "default" },
] as const;
