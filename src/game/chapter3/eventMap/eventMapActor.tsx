import type { ReactNode } from "react";

/**
 * Phase 5: the event-map person (Floor 3 escape map rules, shared with Floor 4): the pose's measured alpha box
 * (alpha > 128) is what is placed — `x` is the centre of the visible box and the bottom alpha row sits on the
 * ground line — so swapping poses keeps the feet, the centre and (with matched visibleH) the size. Mirroring
 * follows each image's own natural facing. Moves are CSS `left` transitions; the procedural walk (CSS, see
 * .u3em-walker) runs only while `walking`.
 */
export type EventMapPose = { src: string; w: number; h: number; top: number; bottom: number; left: number; right: number; natural: "L" | "R"; visibleH: number };
export const poseWidth = (pose: EventMapPose) => (pose.right - pose.left) * pose.visibleH / (pose.bottom - pose.top);
export const poseElementHeight = (pose: EventMapPose) => pose.visibleH * pose.h / (pose.bottom - pose.top);

export type EventMapActorState = { pose: string; x: number; facing: "L" | "R"; shown: boolean; moveMs: number; fadeMs: number; z: number; walking: boolean; pace: "walk" | "hurry" };

export function EventMapActor({ id, actor, pose, groundY, phaseMs, children }: {
  id: string; actor: EventMapActorState; pose: EventMapPose; groundY: number; phaseMs: number; children?: ReactNode;
}) {
  const elementH = poseElementHeight(pose);
  const elementW = elementH * pose.w / pose.h;
  const below = (pose.h - pose.bottom) / pose.h * elementH;
  const flip = actor.facing !== pose.natural;
  return (
    <div className={`u3em-actor ${actor.shown ? "is-shown" : ""}`} data-actor={id} data-facing={actor.facing} data-pose={actor.pose} data-walking={actor.walking ? "1" : "0"}
      style={{
        left: actor.x - ((pose.left + pose.right) / 2 / pose.w - 0.5) * elementW * (flip ? -1 : 1),
        top: groundY + below - elementH, width: elementW, height: elementH, zIndex: 10 + actor.z,
        transitionDuration: `${actor.moveMs}ms, ${actor.fadeMs}ms`,
        ["--walk-phase" as string]: `${-phaseMs}ms`, ["--foot-y" as string]: `${(pose.bottom / pose.h) * 100}%`,
      }}>
      <div className={`u3em-walker ${actor.walking ? `is-walking is-${actor.pace}` : ""}`}>
        <img src={pose.src} alt="" draggable={false} style={{ transform: flip ? "scaleX(-1)" : undefined }} />
      </div>
      {children}
    </div>
  );
}

export function decodeImages(urls: readonly string[], timeoutMs: number): Promise<void> {
  const each = urls.map((url) => new Promise<void>((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => { if (!image.decode) { resolve(); return; } void image.decode().catch(() => undefined).finally(() => resolve()); };
    image.onerror = () => resolve();
    image.src = url;
  }));
  return Promise.race([Promise.all(each).then(() => undefined), new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs))]);
}
