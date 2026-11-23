import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Continuously scrolling cloud/atmosphere layer (right → left) in map coordinates.
 *
 * The source tile is mirrored once ([A | flipped A]) into a 2W-wide canvas tile. Because a mirror always meets
 * itself at the same pixel column, the repeated tile has no seam, and a single element with `repeat-x`
 * means there are no tile boundaries that could open up as hairlines under scaling. Position is derived from
 * the shared clock, so remounts, camera moves and resizes never cause a jump.
 */
const tileCache = new Map<string, Promise<string>>();

export function prepareLoopTile(url: string, width: number, height: number): Promise<string> {
  const key = `${url}|${width}x${height}`;
  const cached = tileCache.get(key);
  if (cached) return cached;
  const promise = new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * 2;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) { resolve(url); return; }
      context.drawImage(image, 0, 0, width, height);
      context.save();
      context.translate(width * 2, 0);
      context.scale(-1, 1);
      context.drawImage(image, 0, 0, width, height);
      context.restore();
      canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : url), "image/png");
    };
    image.onerror = () => { tileCache.delete(key); reject(new Error(`loop tile failed: ${url}`)); };
    image.src = url;
  });
  tileCache.set(key, promise);
  return promise;
}

const CLOCK_ORIGIN = typeof performance !== "undefined" ? performance.now() : 0;

export function LoopingLayer({ src, width, height, speed, z, className = "" }: {
  src: string;
  width: number;
  height: number;
  /** map px per second, leftwards */
  speed: number;
  z: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [tile, setTile] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    prepareLoopTile(src, width, height).then((url) => { if (alive) setTile(url); }).catch(() => { if (alive) setTile(src); });
    return () => { alive = false; };
  }, [height, src, width]);

  const position = () => -(((performance.now() - CLOCK_ORIGIN) / 1000) * speed % (width * 2));

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !tile) return;
    let frame = 0;
    const tick = () => {
      element.style.backgroundPositionX = `${position()}px`;
      frame = requestAnimationFrame(tick);
    };
    element.style.backgroundPositionX = `${position()}px`;
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tile, speed, width]);

  return (
    <div
      ref={ref}
      className={`map-stage-layer map-stage-loop ${className}`}
      data-loop-src={src}
      style={{
        zIndex: z,
        backgroundImage: tile ? `url("${tile}")` : undefined,
        backgroundSize: `${width * 2}px ${height}px`,
        backgroundRepeat: "repeat-x",
      }}
    />
  );
}
