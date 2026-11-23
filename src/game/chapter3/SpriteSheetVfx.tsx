import { useEffect, useRef, useState } from "react";

/** Aseprite-style JSON (as exported by pixelfx): frames with rect + duration, meta.pixelfx.pivot/loop. */
export type SheetJson = {
  frames: { frame: { x: number; y: number; w: number; h: number }; duration: number }[];
  meta: { size: { w: number; h: number }; pixelfx?: { pivot?: [number, number]; loop?: boolean; fps?: number } };
};

const jsonCache = new Map<string, Promise<SheetJson>>();
export function loadSheetJson(url: string): Promise<SheetJson> {
  let cached = jsonCache.get(url);
  if (!cached) {
    cached = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      return response.json() as Promise<SheetJson>;
    });
    cached.catch(() => jsonCache.delete(url));
    jsonCache.set(url, cached);
  }
  return cached;
}

/**
 * Plays a sprite sheet with the per-frame durations from its JSON, anchored so the sheet pivot sits at
 * (x, y) in map coordinates. `scale` = map px per sheet px.
 */
export function SpriteSheetVfx({ sheetUrl, jsonUrl, x, y, scale, z, className = "" }: {
  sheetUrl: string; jsonUrl: string; x: number; y: number; scale: number; z: number; className?: string;
}) {
  const [sheet, setSheet] = useState<SheetJson | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    loadSheetJson(jsonUrl).then((data) => { if (alive) setSheet(data); }).catch(() => undefined);
    return () => { alive = false; };
  }, [jsonUrl]);

  useEffect(() => {
    const element = ref.current;
    if (!sheet || !element || sheet.frames.length === 0) return;
    const total = sheet.frames.reduce((sum, frame) => sum + frame.duration, 0);
    const loop = sheet.meta.pixelfx?.loop ?? true;
    const startedAt = performance.now();
    let frameIndex = -1;
    let raf = 0;
    const tick = (now: number) => {
      let t = now - startedAt;
      if (loop) t %= total;
      let index = 0;
      for (let acc = 0; index < sheet.frames.length - 1; index += 1) {
        acc += sheet.frames[index].duration;
        if (t < acc) break;
      }
      if (index !== frameIndex) {
        frameIndex = index;
        const f = sheet.frames[index].frame;
        element.style.backgroundPosition = `${-f.x * scale}px ${-f.y * scale}px`;
        element.dataset.frame = String(index);
      }
      if (loop || t < total) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scale, sheet]);

  if (!sheet) return null;
  const first = sheet.frames[0].frame;
  const pivot = sheet.meta.pixelfx?.pivot ?? [first.w / 2, first.h / 2];
  return (
    <div
      ref={ref}
      className={`map-stage-sheet ${className}`}
      style={{
        zIndex: z,
        left: x - pivot[0] * scale,
        top: y - pivot[1] * scale,
        width: first.w * scale,
        height: first.h * scale,
        backgroundImage: `url("${sheetUrl}")`,
        backgroundSize: `${sheet.meta.size.w * scale}px ${sheet.meta.size.h * scale}px`,
        backgroundPosition: `${-first.x * scale}px ${-first.y * scale}px`,
      }}
      aria-hidden="true"
    />
  );
}
