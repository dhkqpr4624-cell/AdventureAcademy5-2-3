import { useEffect, useRef } from "react";

/**
 * Plays a grid sprite sheet (cols × rows, row-major frames) at a fixed fps. Frames are advanced with
 * requestAnimationFrame writing `background-position` directly — no React state per frame. `paused` freezes the
 * current frame (time does not advance while paused). One-shots hold their last frame and call `onEnd` once.
 */
export function GridSprite({ src, cols, rows, frames, fps, frameW, frameH, scale, loop, paused = false, onEnd, onFrame, className = "", style }: {
  src: string; cols: number; rows: number; frames: number; fps: number; frameW: number; frameH: number; scale: number;
  loop: boolean; paused?: boolean; onEnd?: () => void; onFrame?: (index: number) => void; className?: string; style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let raf = 0;
    let last = performance.now();
    let elapsed = 0;
    let shown = -1;
    let ended = false;
    const frameMs = 1000 / fps;
    const draw = (index: number) => {
      if (index === shown) return;
      shown = index;
      const col = index % cols;
      const row = Math.floor(index / cols);
      element.style.backgroundPosition = `${-col * frameW * scale}px ${-row * frameH * scale}px`;
      element.dataset.frame = String(index);
      onFrameRef.current?.(index);
    };
    draw(0);
    const tick = (now: number) => {
      const delta = now - last;
      last = now;
      if (!pausedRef.current) elapsed += delta;
      let index = Math.floor(elapsed / frameMs);
      if (loop) index %= frames;
      else if (index >= frames) {
        index = frames - 1;
        if (!ended) { ended = true; draw(index); onEndRef.current?.(); return; }
      }
      draw(index);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [src, cols, frames, fps, frameW, frameH, scale, loop]);

  return <div ref={ref} className={`u3em-sprite ${className}`} style={{
    ...style,
    width: frameW * scale, height: frameH * scale,
    backgroundImage: `url(${src})`, backgroundSize: `${cols * frameW * scale}px ${rows * frameH * scale}px`,
  }} />;
}
