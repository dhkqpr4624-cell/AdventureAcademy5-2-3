import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * One map coordinate system for layers, actors (feet), VFX and camera.
 * The world box (width x height map px) is scaled to cover the viewport ("cover", like the base camp viewport),
 * then zoomed/panned by the camera. The camera centre is clamped every frame so the map edge is never revealed,
 * including while a pan or zoom is animating.
 */
export type MapCamera = { x: number; y: number; zoom: number; durationMs?: number };

type MapStageProps = {
  width: number;
  height: number;
  camera: MapCamera;
  className?: string;
  children: ReactNode;
};

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function clampCameraCenter(camera: MapCamera, viewport: { width: number; height: number }, world: { width: number; height: number }) {
  const base = Math.max(viewport.width / world.width, viewport.height / world.height);
  const scale = base * Math.max(1, camera.zoom);
  const halfW = viewport.width / scale / 2;
  const halfH = viewport.height / scale / 2;
  const clampAxis = (value: number, half: number, size: number) => (half * 2 >= size ? size / 2 : Math.min(Math.max(value, half), size - half));
  return { x: clampAxis(camera.x, halfW, world.width), y: clampAxis(camera.y, halfH, world.height), scale };
}

export function MapStage({ width, height, camera, className = "", children }: MapStageProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  const currentRef = useRef<MapCamera>({ ...camera });
  const frameRef = useRef<number | null>(null);

  const apply = (value: MapCamera) => {
    const world = worldRef.current;
    const size = sizeRef.current;
    if (!world || size.width === 0) return;
    const center = clampCameraCenter(value, size, { width, height });
    const tx = size.width / 2 - center.x * center.scale;
    const ty = size.height / 2 - center.y * center.scale;
    world.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${center.scale})`;
  };

  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const update = () => {
      const bounds = element.getBoundingClientRect();
      sizeRef.current = { width: bounds.width, height: bounds.height };
      apply(currentRef.current);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  useEffect(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    const from = { ...currentRef.current };
    const to = { x: camera.x, y: camera.y, zoom: camera.zoom };
    const duration = camera.durationMs ?? 0;
    if (duration <= 0) {
      currentRef.current = to;
      apply(to);
      return;
    }
    // Animate the *clamped* centres so a pan that starts against an edge moves at a steady pace.
    const size = sizeRef.current;
    const start = clampCameraCenter(from, size, { width, height });
    const end = clampCameraCenter(to, size, { width, height });
    const startedAt = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      const k = easeInOutCubic(t);
      const value = { x: start.x + (end.x - start.x) * k, y: start.y + (end.y - start.y) * k, zoom: from.zoom + (to.zoom - from.zoom) * k };
      currentRef.current = value;
      apply(value);
      frameRef.current = t < 1 ? requestAnimationFrame(tick) : null;
      if (t >= 1) currentRef.current = to;
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.x, camera.y, camera.zoom, camera.durationMs, width, height]);

  return (
    <div ref={viewportRef} className={`map-stage ${className}`}>
      <div ref={worldRef} className="map-stage-world" style={{ width, height } as CSSProperties}>
        {children}
      </div>
    </div>
  );
}

/** A full-map image layer. Every layer is stretched to the shared map box so 1670/1671px sources line up. */
export function MapLayer({ src, z, className = "" }: { src: string; z: number; className?: string }) {
  return <img className={`map-stage-layer ${className}`} src={src} alt="" draggable={false} style={{ zIndex: z }} />;
}
