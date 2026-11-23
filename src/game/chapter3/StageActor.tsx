import type { CSSProperties, ReactNode } from "react";
import { CHAPTER3_STAGE_SPRITES, STAGE_SPRITE_SCALE, type Chapter3ActorId, type Facing } from "../../data/chapter3/chapter3Actors";

export type StageActorProps = {
  id: Chapter3ActorId;
  /** feet position in map px */
  x: number;
  footY: number;
  facing: Facing;
  walking?: boolean;
  /** ms for a horizontal move between phases (CSS transition on left) */
  moveMs?: number;
  enter?: "fade" | "warp" | "none";
  children?: ReactNode;
};

/** A map sprite whose feet (bottom of visible pixels) sit on (x, footY). */
export function StageActor({ id, x, footY, facing, walking = false, moveMs = 0, enter = "none", children }: StageActorProps) {
  const sprite = CHAPTER3_STAGE_SPRITES[id];
  const width = sprite.frameWidth * STAGE_SPRITE_SCALE;
  const height = sprite.frameHeight * STAGE_SPRITE_SCALE;
  const own = sprite.images[facing];
  const other = sprite.images[facing === "L" ? "R" : "L"];
  const src = own ?? other ?? "";
  const mirrored = !own;
  const walk = walking && sprite.walk ? sprite.walk : null;
  const style = {
    left: x - sprite.cx * width,
    top: footY - sprite.foot * height,
    width,
    height,
    transitionDuration: `${moveMs}ms`,
    "--walk-frames": walk?.frames ?? 1,
    "--walk-duration": walk ? `${(walk.frames / walk.fps) * 1000}ms` : "0ms",
  } as CSSProperties;
  return (
    <div className={`stage-actor stage-actor-${id} is-enter-${enter} ${walk ? "is-walking" : ""}`} style={style} data-actor={id} data-facing={facing}>
      <div className="stage-actor-body">
        {walk ? (
          <span className="stage-actor-walk" style={{ backgroundImage: `url("${walk.images[facing]}")` }} />
        ) : (
          <img src={src} alt="" draggable={false} style={mirrored ? { transform: "scaleX(-1)" } : undefined} />
        )}
      </div>
      {children}
    </div>
  );
}
