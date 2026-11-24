"""Unit 3 Floor 1 monster attack VFX sprite sheets (procedural pixel art).

PixelFX could not be executed in the Phase 2 build environment, so these three attack effects are drawn
procedurally with Pillow instead (deterministic, no external input). Each sheet is 8 frames of
128x128 px drawn on a small grid and scaled x2 with nearest-neighbour, laid out horizontally (2048x256).

  ink-splash.png        먹물 든 을사늑약 문서 — ink blots burst toward the viewer
  shadow-lantern.png    길을 막는 그림자 (구 밀고의 그림자) — a dark lantern bolt rushes forward and bursts
  sabre-slash.png       봉쇄의 파수꾼 (구 통감부 감시자) — a steel sabre slash with a red edge

Usage: python3 scripts/chapter3/make_floor1_monster_vfx.py public/assets/chapter3/floor1/vfx
"""
import math
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw

FRAMES = 8
SIZE = 128
SCALE = 2


def sheet(draw_frame):
    out = Image.new("RGBA", (SIZE * FRAMES, SIZE), (0, 0, 0, 0))
    for index in range(FRAMES):
        frame = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        draw_frame(ImageDraw.Draw(frame), index / (FRAMES - 1), index)
        out.paste(frame, (index * SIZE, 0), frame)
    return out.resize((SIZE * FRAMES * SCALE, SIZE * SCALE), Image.NEAREST)


def ink(draw, t, index):
    rng = random.Random(11)
    cx = cy = SIZE / 2
    blots = [(rng.uniform(0, math.tau), rng.uniform(0.35, 1.0), rng.uniform(3, 9)) for _ in range(26)]
    core = 10 + 34 * min(1.0, t * 1.6)
    alpha = int(255 * (1 - max(0.0, (t - 0.65) / 0.35)))
    draw.ellipse([cx - core, cy - core * 0.85, cx + core, cy + core * 0.85], fill=(14, 10, 18, alpha))
    for angle, speed, radius in blots:
        dist = 8 + 56 * speed * min(1.0, t * 1.3)
        x = cx + math.cos(angle) * dist
        y = cy + math.sin(angle) * dist * 0.9
        r = radius * (0.6 + t)
        draw.ellipse([x - r, y - r, x + r, y + r], fill=(20, 14, 26, alpha))
        if t > 0.3:
            hr = max(1, r * 0.35)
            draw.ellipse([x - hr - 1, y - hr - 1, x + hr - 1, y + hr - 1], fill=(92, 70, 110, alpha))
    # red seal fragments from the treaty
    for k in range(6):
        a = k * math.tau / 6 + 0.4
        d = 20 + 40 * t
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d
        draw.rectangle([x - 2, y - 2, x + 2, y + 2], fill=(190, 40, 40, alpha))


def lantern(draw, t, index):
    cx = SIZE / 2
    cy = SIZE / 2
    if t < 0.6:
        p = t / 0.6
        r = 6 + 26 * p
        for ring in range(5, 0, -1):
            rr = r + ring * 4
            draw.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=(60, 20, 90, int(40 + 10 * (5 - ring))))
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(20, 6, 30, 255))
        draw.ellipse([cx - r * 0.45, cy - r * 0.45, cx + r * 0.45, cy + r * 0.45], fill=(190, 120, 255, 255))
        for k in range(10):
            a = k * math.tau / 10 + t * 6
            x1, y1 = cx + math.cos(a) * r, cy + math.sin(a) * r
            x2, y2 = cx + math.cos(a) * (r + 10), cy + math.sin(a) * (r + 10)
            draw.line([x1, y1, x2, y2], fill=(140, 60, 220, 220), width=2)
    else:
        p = (t - 0.6) / 0.4
        alpha = int(255 * (1 - p))
        r = 32 + 40 * p
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(160, 80, 240, alpha), width=6)
        for k in range(14):
            a = k * math.tau / 14
            d = r * 0.9
            x, y = cx + math.cos(a) * d, cy + math.sin(a) * d
            draw.rectangle([x - 3, y - 3, x + 3, y + 3], fill=(30, 8, 46, alpha))


def sabre(draw, t, index):
    p = min(1.0, t * 1.5)
    fade = 1 - max(0.0, (t - 0.55) / 0.45)
    start = math.radians(205)
    end = start - math.radians(110) * p
    cx, cy, radius = SIZE * 0.78, SIZE * 0.22, SIZE * 0.66
    steps = 40
    for s in range(steps):
        a0 = start + (end - start) * s / steps
        a1 = start + (end - start) * (s + 1) / steps
        w = 2 + 9 * (s / steps)
        x0, y0 = cx + math.cos(a0) * radius, cy + math.sin(a0) * radius
        x1, y1 = cx + math.cos(a1) * radius, cy + math.sin(a1) * radius
        draw.line([x0, y0, x1, y1], fill=(150, 20, 30, int(200 * fade)), width=int(w + 4))
        draw.line([x0, y0, x1, y1], fill=(235, 240, 250, int(255 * fade)), width=int(w))
    if t > 0.25:
        tip_a = end
        tx, ty = cx + math.cos(tip_a) * radius, cy + math.sin(tip_a) * radius
        for k in range(6):
            a = k * math.tau / 6
            draw.line([tx, ty, tx + math.cos(a) * 9, ty + math.sin(a) * 9], fill=(255, 250, 220, int(230 * fade)), width=2)


def main():
    out_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "public/assets/chapter3/floor1/vfx")
    out_dir.mkdir(parents=True, exist_ok=True)
    sheet(ink).save(out_dir / "ink-splash.png", optimize=True)
    sheet(lantern).save(out_dir / "shadow-lantern.png", optimize=True)
    sheet(sabre).save(out_dir / "sabre-slash.png", optimize=True)
    print("wrote", sorted(p.name for p in out_dir.glob("*.png")))


if __name__ == "__main__":
    main()
