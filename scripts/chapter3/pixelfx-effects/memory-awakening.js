// PixelFX remix authored for AdventureAcademy5-2-3 (Phase 4 hotfix 2): 카프's memory returns.
// Copied into a PixelFX checkout's src/fx/holy/ and indexed with `node tools/index.mjs`, then rendered with
//   node tools/render.mjs holy/memory-awakening --sheet --no-actor
// Uses only PixelFX core drawing (glow, blend, dot, sparkle) — no character pixels are drawn (works with no actor).
import { fit, sparkle, rng, clamp, smooth, seg, lerp, ease, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Memory Awakening",
  desc: "Warm light wells up around the body, swells into a soft cocoon that wraps the whole figure, peaks, then loosens into small motes that drift up and outward and wink out. Gentle, local, never a flash.",
  tags: ["holy", "light", "buff", "awaken", "character", "one-shot"],
  size: [112, 176],
  origin: [56, 166],
  duration: 2.4,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: { palette: ["#3b2a1e", "#7a5a34", "#b8904e", "#e6c27a", "#f7dfa4", "#fff1d2", "#fffaf0", "#ffffff"], seed: 11 },
};

const PEAK = 1.0, BODY_Y = -74, RX = 40, RY = 78;

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8);
  const rise = ease.inOutSine(seg(t, 0, PEAK)), fall = 1 - ease.inOutSine(seg(t, PEAK, PEAK + 0.9));
  const k = t < PEAK ? rise : fall;
  if (k <= 0.01) return;
  // a soft cocoon of light round the body: an ellipse whose fill grows from the feet up to the head
  const top = lerp(0, -2 * RY, t < PEAK ? rise : 1);
  p.each(-RX - 6, -2 * RY - 8, RX + 6, 4, (x, y, sx, sy) => {
    const dx = x / (RX + 4), dy = (y - BODY_Y) / (RY + 6), d = Math.sqrt(dx * dx + dy * dy);
    if (d >= 1) return;
    const edge = smooth(1, 0.55, d), lift = smooth(top - 10, top + 6, y);
    const a = k * edge * (t < PEAK ? lift : 1);
    if (a < 0.02) return;
    p.blendPx(sx, sy, d < 0.45 ? C[6] : C[5], a * (0.34 + 0.46 * k));
    p.add(sx, sy, C[4], a * 0.45);
  });
  p.glow(0, BODY_Y, 64, C[4], 0.28 * k);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8);
  const rise = ease.inOutSine(seg(t, 0, PEAK));
  // the ground catches it: a small warm pool at the feet
  const pool = t < PEAK ? rise : 1 - seg(t, PEAK, PEAK + 1.0);
  for (let x = -26; x <= 26; x++) {
    const u = Math.abs(x) / 26;
    p.dot(x, 0, u < 0.35 ? C[6] : C[5], pool * (1 - u) * 0.8);
  }
  // light welling up: motes rising along the body's outline, more and brighter as it builds
  for (let i = 0; i < 28; i++) {
    const R = rng(o.seed, i), t0 = R.range(0, PEAK - 0.25), life = R.range(0.45, 0.75), age = (t - t0) / life;
    if (age < 0 || age > 1) continue;
    const side = i % 2 ? 1 : -1, x = side * R.range(RX * 0.55, RX + 4) * (1 - 0.25 * age), y = -R.range(0, 30) - age * R.range(60, 120);
    const a = Math.sin(age * Math.PI) * (0.5 + 0.5 * rise);
    p.dot(x, y, a > 0.7 ? WHITE : C[6], a);
    p.glow(x, y, 3, C[5], 0.3 * a);
  }
  // the peak: the whole figure wrapped in light (soft, local — kept well under a full-frame flash)
  const peak = smooth(PEAK - 0.35, PEAK, t) * (1 - smooth(PEAK, PEAK + 0.35, t));
  if (peak > 0.01) {
    // at the brightest moment the whole figure is wrapped (near-opaque warm white inside the cocoon)
    p.each(-RX - 2, -2 * RY - 4, RX + 2, 2, (x, y, sx, sy) => {
      const dx = x / (RX + 2), dy = (y - BODY_Y) / (RY + 2), d = Math.sqrt(dx * dx + dy * dy);
      if (d >= 1) return;
      p.blendPx(sx, sy, d < 0.6 ? WHITE : C[6], peak * 0.95 * smooth(1, 0.7, d));
    });
    p.disc(0, BODY_Y, lerp(18, 34, peak), (d) => (d < 0.5 ? WHITE : C[6]), (d) => peak * 0.55 * (1 - d * d));
    p.glow(0, BODY_Y, 70, C[6], 0.45 * peak);
    sparkle(p, 0, BODY_Y - 40, 6 * peak, WHITE, C[5], 0.55 * peak);
  }
  // after the peak the light loosens into motes drifting up and outward, twinkling and winking out
  for (let i = 0; i < 46; i++) {
    const R = rng(o.seed + 7, i), t0 = PEAK + R.range(-0.05, 0.35), life = R.range(0.8, 1.3), age = (t - t0) / life;
    if (age < 0 || age > 1) continue;
    const ang = R.range(-Math.PI * 0.92, -Math.PI * 0.08), sp = R.range(26, 64), e = ease.outCubic ? ease.outCubic(age) : 1 - (1 - age) ** 3;
    const x0 = R.range(-RX, RX) * 0.8, y0 = BODY_Y + R.range(-RY * 0.8, RY * 0.6);
    const x = x0 + Math.cos(ang) * sp * e, y = y0 + Math.sin(ang) * sp * e - age * 18;
    const tw = 0.6 + 0.4 * Math.sin(age * 14 + i), a = clamp((1 - age) * 1.2, 0, 1) * tw;
    if (i % 5 === 0) sparkle(p, x, y, 2 * a + 0.5, WHITE, C[5], 0.5 * a);
    else { p.dot(x, y, a > 0.75 ? WHITE : i % 3 ? C[6] : C[4], a); p.glow(x, y, 3, C[5], 0.25 * a); }
  }
}
