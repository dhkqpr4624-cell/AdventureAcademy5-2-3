import { useEffect, useRef } from "react";
import type { BaseCampTramDefinition } from "../../types/baseCamp";

/** Pure schedule helpers (unit-checked in chapter3Checks). */
export function rollTramDelayMs(random: number, [minimum, maximum]: readonly [number, number]) {
  return (minimum + Math.min(1, Math.max(0, random)) * (maximum - minimum)) * 1000;
}

/** Left edge of the tram at time t (ms since departure): from fully right of the map to fully left of it. */
export function tramLeftAt(elapsedMs: number, tram: BaseCampTramDefinition, worldWidth: number) {
  const start = worldWidth;
  const end = -tram.width;
  const progress = Math.min(1, Math.max(0, elapsedMs / (tram.crossingSeconds * 1000)));
  return start + (end - start) * progress;
}

/**
 * One tram at a time, at constant speed. A random wait is rolled before the first appearance
 * (`firstDelaySeconds`, else `intervalSeconds`) and after each pass (`intervalSeconds`); the pass ends only when
 * the whole car body is off the left edge, so two cars never overlap. One timer / animation frame at most; all are
 * released on unmount (leaving the base camp).
 */
export function BaseCampTram({ tram, worldWidth, zIndex }: { tram: BaseCampTramDefinition; worldWidth: number; zIndex: number }) {
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let timer: number | null = null;
    let frame: number | null = null;
    let disposed = false;
    const hide = () => {
      element.style.visibility = "hidden";
      element.style.transform = `translate3d(${worldWidth}px, 0, 0)`;
      element.dataset.state = "waiting";
    };
    let first = true;
    const schedule = () => {
      if (disposed) return;
      const delay = rollTramDelayMs(Math.random(), first && tram.firstDelaySeconds ? tram.firstDelaySeconds : tram.intervalSeconds);
      first = false;
      element.dataset.nextDelayMs = String(Math.round(delay));
      timer = window.setTimeout(depart, delay);
    };
    const depart = () => {
      timer = null;
      if (disposed) return;
      const startedAt = performance.now();
      element.style.visibility = "visible";
      element.dataset.state = "running";
      const tick = (now: number) => {
        if (disposed) return;
        const elapsed = now - startedAt;
        element.style.transform = `translate3d(${tramLeftAt(elapsed, tram, worldWidth)}px, 0, 0)`;
        if (elapsed >= tram.crossingSeconds * 1000) {
          frame = null;
          hide();
          schedule();
          return;
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    hide();
    schedule();
    return () => {
      disposed = true;
      if (timer !== null) window.clearTimeout(timer);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [tram, worldWidth]);

  return (
    <img
      ref={ref}
      className="base-camp-tram"
      src={tram.src}
      alt=""
      draggable={false}
      data-testid="base-camp-tram"
      style={{ zIndex, top: tram.y, left: 0, width: tram.width, height: tram.height }}
    />
  );
}
