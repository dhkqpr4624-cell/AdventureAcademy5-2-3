import { useEffect, useState } from "react";

/**
 * Phase 4 hotfix — cached hover outlines for base-camp sprites.
 *
 * The white hover outline used to be a CSS `filter` chain of 8 (NPC) or 4 (dungeon entrance) `drop-shadow()`s.
 * A filtered layer is re-filtered every time the compositor redraws the frame, and the base camp redraws
 * continuously (clouds, tram, quest markers), so hovering cost one full-surface filter pass per drop-shadow per
 * frame — on the full 1672×941 entrance layer that dropped the camp from ~59 to ~8 fps (measured).
 *
 * The same chain is now rendered ONCE into an image (per source image, display size and offset chain; cached for
 * the session) and shown beneath the sprite while hovered — only its opacity changes, so the compositor just
 * draws one more textured quad. The rendering reproduces `drop-shadow` exactly: every step draws a white
 * silhouette of the current result shifted by the offset (alpha × step alpha) and then the result on top.
 * Animated sprites (NPC blink, entrance loop) keep one outline because their silhouette never changes.
 */
export type OutlineStep = readonly [dx: number, dy: number, alpha: number];

export const NPC_OUTLINE_STEPS: readonly OutlineStep[] = [
  [1, 0, 0.98], [-1, 0, 0.98], [0, 1, 0.98], [0, -1, 0.98],
  [1, 1, 0.92], [-1, 1, 0.92], [1, -1, 0.92], [-1, -1, 0.92],
];
export const GATE_OUTLINE_STEPS: readonly OutlineStep[] = [[2, 0, 0.98], [-2, 0, 0.98], [0, 2, 0.98], [0, -2, 0.98]];

/** Margin the outline can reach beyond the sprite box (sum of the step lengths). */
export const outlinePadding = (steps: readonly OutlineStep[]) => steps.reduce((sum, [dx, dy]) => sum + Math.max(Math.abs(dx), Math.abs(dy)), 0);

const cache = new Map<string, Promise<string | null>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`outline source failed: ${src}`));
    image.src = src;
  });
}
const idle = () => new Promise<void>((resolve) => {
  const request = (window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
  if (request) request(() => resolve(), { timeout: 800 }); else window.setTimeout(resolve, 0);
});

async function render(src: string, width: number, height: number, steps: readonly OutlineStep[]): Promise<string | null> {
  if (typeof document === "undefined") return null;
  const image = await loadImage(src);
  await idle();
  const pad = outlinePadding(steps);
  const w = Math.ceil(width) + pad * 2;
  const h = Math.ceil(height) + pad * 2;
  const make = () => { const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h; return canvas; };
  let current = make();
  const base = current.getContext("2d");
  if (!base) return null;
  base.drawImage(image, pad, pad, width, height);
  for (const [dx, dy, alpha] of steps) {
    // drop-shadow(dx dy 0 rgba(255,255,255,alpha)) of `current`, then `current` itself on top
    const shadow = make();
    const shadowContext = shadow.getContext("2d")!;
    shadowContext.drawImage(current, dx, dy);
    shadowContext.globalCompositeOperation = "source-in";
    shadowContext.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    shadowContext.fillRect(0, 0, w, h);
    shadowContext.globalCompositeOperation = "source-over";
    shadowContext.drawImage(current, 0, 0);
    current = shadow;
  }
  const blob = await new Promise<Blob | null>((resolve) => current.toBlob(resolve, "image/png"));
  return blob ? URL.createObjectURL(blob) : null;
}

/** The outline image (object URL) for `src` drawn at width×height, or null while it is being prepared / on failure. */
export function getOutlineImage(src: string, width: number, height: number, steps: readonly OutlineStep[]): Promise<string | null> {
  const key = `${src}|${Math.round(width)}x${Math.round(height)}|${steps.map((step) => step.join(",")).join(";")}`;
  let promise = cache.get(key);
  if (!promise) {
    promise = render(src, width, height, steps).catch(() => null);
    cache.set(key, promise);
  }
  return promise;
}

/** React hook: prepares the outline in idle time after mount; returns its URL once ready (CSS filter fallback until then). */
export function useOutlineImage(src: string | undefined, width: number, height: number, steps: readonly OutlineStep[]): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!src) return;
    let alive = true;
    void getOutlineImage(src, width, height, steps).then((result) => { if (alive) setUrl(result); });
    return () => { alive = false; };
  }, [src, width, height, steps]);
  return url;
}
