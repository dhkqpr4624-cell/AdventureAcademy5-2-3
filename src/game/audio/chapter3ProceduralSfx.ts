/**
 * Unit 3 intro ambience/SFX synthesized with the Web Audio API.
 * Neither the Unit 2 nor the Unit 1 repository ships a wind loop or a warp/distortion sound, so these are
 * generated at runtime (no audio files). One shared AudioContext; every voice disconnects its nodes when stopped.
 *
 * - wind: looping low band-passed noise with a slow gust LFO.
 * - warp: rising charge (sine sweep + shimmer) that can be switched to a "distorted" collapse.
 */

type Voice = { nodes: AudioNode[]; sources: AudioScheduledSourceNode[]; out: GainNode; timer: number | null };

let context: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let gestureInstalled = false;
const voices = new Set<Voice>();

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!context) {
    try {
      context = new Ctor();
    } catch {
      return null;
    }
    master = context.createGain();
    master.gain.value = 0.8;
    const compressor = context.createDynamicsCompressor();
    master.connect(compressor);
    compressor.connect(context.destination);
    const length = context.sampleRate * 2;
    noise = context.createBuffer(1, length, context.sampleRate);
    const data = noise.getChannelData(0);
    let seed = 0x9e3779b9;
    for (let index = 0; index < length; index += 1) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[index] = seed / 2147483648 - 1;
    }
  }
  if (!gestureInstalled && typeof document !== "undefined") {
    gestureInstalled = true;
    const resume = () => { if (context?.state === "suspended") void context.resume().catch(() => undefined); };
    document.addEventListener("pointerdown", resume, { passive: true });
    document.addEventListener("keydown", resume);
  }
  if (context.state === "suspended") void context.resume().catch(() => undefined);
  return context;
}

function release(voice: Voice, fadeMs: number) {
  if (!context || !voices.has(voice)) return;
  const now = context.currentTime;
  voice.out.gain.cancelScheduledValues(now);
  voice.out.gain.setValueAtTime(voice.out.gain.value, now);
  voice.out.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
  if (voice.timer !== null) window.clearTimeout(voice.timer);
  voice.timer = window.setTimeout(() => {
    voice.sources.forEach((source) => { try { source.stop(); } catch { /* already stopped */ } });
    [...voice.nodes, voice.out].forEach((node) => node.disconnect());
    voices.delete(voice);
  }, fadeMs + 80);
}

export type Chapter3SfxHandle = { stop: (fadeMs?: number) => void };
const NOOP: Chapter3SfxHandle = { stop: () => undefined };

export function startWindLoop(level = 0.22, fadeInMs = 1800): Chapter3SfxHandle {
  const ctx = getContext();
  if (!ctx || !master || !noise) return NOOP;
  const source = ctx.createBufferSource();
  source.buffer = noise;
  source.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 420;
  band.Q.value = 0.7;
  const low = ctx.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.value = 900;
  const gust = ctx.createOscillator();
  gust.frequency.value = 0.13;
  const gustDepth = ctx.createGain();
  gustDepth.gain.value = 180;
  gust.connect(gustDepth);
  gustDepth.connect(band.frequency);
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, ctx.currentTime);
  out.gain.linearRampToValueAtTime(level, ctx.currentTime + fadeInMs / 1000);
  source.connect(band);
  band.connect(low);
  low.connect(out);
  out.connect(master);
  source.start();
  gust.start();
  const voice: Voice = { nodes: [source, band, low, gust, gustDepth], sources: [source, gust], out, timer: null };
  voices.add(voice);
  return { stop: (fadeMs = 600) => release(voice, fadeMs) };
}

export type WarpHandle = Chapter3SfxHandle & { distort: () => void };

/** Rising warp charge over `chargeMs`; `distort()` bends it into a warped collapse and fades it out. */
export function startWarpCharge(chargeMs = 4200): WarpHandle {
  const ctx = getContext();
  if (!ctx || !master || !noise) return { ...NOOP, distort: () => undefined };
  const now = ctx.currentTime;
  const tone = ctx.createOscillator();
  tone.type = "sine";
  tone.frequency.setValueAtTime(180, now);
  tone.frequency.exponentialRampToValueAtTime(880, now + chargeMs / 1000);
  const shimmer = ctx.createOscillator();
  shimmer.type = "triangle";
  shimmer.frequency.setValueAtTime(360, now);
  shimmer.frequency.exponentialRampToValueAtTime(1760, now + chargeMs / 1000);
  const tremolo = ctx.createOscillator();
  tremolo.frequency.setValueAtTime(5, now);
  tremolo.frequency.linearRampToValueAtTime(19, now + chargeMs / 1000);
  const tremoloDepth = ctx.createGain();
  tremoloDepth.gain.value = 0.35;
  const shimmerGain = ctx.createGain();
  shimmerGain.gain.value = 0.4;
  tremolo.connect(tremoloDepth);
  tremoloDepth.connect(shimmerGain.gain);
  const air = ctx.createBufferSource();
  air.buffer = noise;
  air.loop = true;
  const airFilter = ctx.createBiquadFilter();
  airFilter.type = "highpass";
  airFilter.frequency.setValueAtTime(1200, now);
  airFilter.frequency.exponentialRampToValueAtTime(5200, now + chargeMs / 1000);
  const airGain = ctx.createGain();
  airGain.gain.value = 0.18;
  const shaper = ctx.createWaveShaper();
  shaper.curve = null;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, now);
  out.gain.exponentialRampToValueAtTime(0.34, now + chargeMs / 1000);
  tone.connect(shaper);
  shimmer.connect(shimmerGain);
  shimmerGain.connect(shaper);
  air.connect(airFilter);
  airFilter.connect(airGain);
  airGain.connect(shaper);
  shaper.connect(out);
  out.connect(master);
  tone.start(now);
  shimmer.start(now);
  tremolo.start(now);
  air.start(now);
  const voice: Voice = {
    nodes: [tone, shimmer, tremolo, tremoloDepth, shimmerGain, air, airFilter, airGain, shaper],
    sources: [tone, shimmer, tremolo, air],
    out,
    timer: null,
  };
  voices.add(voice);
  let distorted = false;
  return {
    stop: (fadeMs = 300) => release(voice, fadeMs),
    distort: () => {
      if (distorted || !voices.has(voice)) return;
      distorted = true;
      const t = ctx.currentTime;
      const curve = new Float32Array(1024);
      for (let index = 0; index < curve.length; index += 1) {
        const x = (index / (curve.length - 1)) * 2 - 1;
        curve[index] = Math.tanh(x * 9) * 0.8;
      }
      shaper.curve = curve;
      tone.frequency.cancelScheduledValues(t);
      tone.frequency.setValueAtTime(tone.frequency.value, t);
      tone.frequency.exponentialRampToValueAtTime(48, t + 1.3);
      shimmer.frequency.cancelScheduledValues(t);
      shimmer.frequency.setValueAtTime(shimmer.frequency.value, t);
      shimmer.frequency.exponentialRampToValueAtTime(70, t + 1.1);
      tremolo.frequency.setValueAtTime(31, t);
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(0.42, t);
      out.gain.linearRampToValueAtTime(0, t + 1.5);
      if (voice.timer !== null) window.clearTimeout(voice.timer);
      voice.timer = window.setTimeout(() => release(voice, 60), 1500);
    },
  };
}

export function stopAllChapter3Sfx(fadeMs = 200): void {
  [...voices].forEach((voice) => release(voice, fadeMs));
}

export function getActiveChapter3VoiceCount(): number {
  return voices.size;
}

/**
 * Phase 2: a cart tipping over (no audio asset was supplied). Wooden thumps (decaying low sines)
 * plus a short scatter of filtered noise; nodes are released automatically after ~1.4 s.
 */
export function playCartCrash(level = 0.55): void {
  const ctx = getContext();
  if (!ctx || !master || !noise) return;
  const now = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = level;
  out.connect(master);
  const nodes: AudioNode[] = [];
  const sources: AudioScheduledSourceNode[] = [];
  [0, 0.11, 0.27, 0.46].forEach((offset, index) => {
    const thump = ctx.createOscillator();
    thump.type = "triangle";
    thump.frequency.setValueAtTime(150 - index * 18, now + offset);
    thump.frequency.exponentialRampToValueAtTime(48, now + offset + 0.22);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.setValueAtTime(index === 0 ? 1 : 0.7 - index * 0.12, now + offset);
    env.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.3);
    thump.connect(env);
    env.connect(out);
    thump.start(now + offset);
    thump.stop(now + offset + 0.35);
    nodes.push(thump, env);
    sources.push(thump);
  });
  const scatter = ctx.createBufferSource();
  scatter.buffer = noise;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 1800;
  band.Q.value = 0.9;
  const scatterEnv = ctx.createGain();
  scatterEnv.gain.setValueAtTime(0.0001, now);
  scatterEnv.gain.linearRampToValueAtTime(0.35, now + 0.05);
  scatterEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
  scatter.connect(band);
  band.connect(scatterEnv);
  scatterEnv.connect(out);
  scatter.start(now);
  scatter.stop(now + 1);
  nodes.push(scatter, band, scatterEnv);
  sources.push(scatter);
  const voice: Voice = { nodes, sources, out, timer: null };
  voices.add(voice);
  voice.timer = window.setTimeout(() => {
    [...voice.nodes, voice.out].forEach((node) => node.disconnect());
    voices.delete(voice);
  }, 1400);
}
