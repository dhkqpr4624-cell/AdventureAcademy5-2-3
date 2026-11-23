import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
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
  /** No walk sheet: the standing frame glides with a small step bob (never a stretched/renamed sheet). */
  const gliding = walking && !sprite.walk;
  const blinkFrame = useBlinkFrame(sprite.blink && !walking ? sprite.blink.frames : 0, sprite.blink?.frameMs ?? 90);
  const blinkSheet = sprite.blink && blinkFrame > 0 ? sprite.blink.images[facing] : null;
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
    <div className={`stage-actor stage-actor-${id} is-enter-${enter} ${walk ? "is-walking" : ""} ${gliding ? "is-gliding" : ""}`} style={style} data-actor={id} data-facing={facing}>
      <div className="stage-actor-body">
        {walk ? (
          <span className="stage-actor-walk" style={{ backgroundImage: `url("${walk.images[facing]}")` }} />
        ) : blinkSheet && sprite.blink ? (
          <span className="stage-actor-blink" style={{ backgroundImage: `url("${blinkSheet}")`, backgroundSize: `${sprite.blink.frames * 100}% 100%`, backgroundPosition: `${(blinkFrame / (sprite.blink.frames - 1)) * 100}% 0` }} />
        ) : (
          <img src={src} alt="" draggable={false} style={mirrored ? { transform: "scaleX(-1)" } : undefined} />
        )}
      </div>
      {children}
    </div>
  );
}

/** Random-interval blink (frames 1..n-1, then back to the standing frame 0). */
function useBlinkFrame(frameCount: number, frameMs: number): number {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (frameCount < 2) return;
    let timer = 0;
    let alive = true;
    const schedule = () => {
      timer = window.setTimeout(() => {
        let next = 1;
        const step = () => {
          if (!alive) return;
          if (next >= frameCount) { setFrame(0); schedule(); return; }
          setFrame(next);
          next += 1;
          timer = window.setTimeout(step, frameMs);
        };
        step();
      }, 3500 + Math.random() * 4500);
    };
    schedule();
    return () => { alive = false; window.clearTimeout(timer); };
  }, [frameCount, frameMs]);
  return frame;
}
