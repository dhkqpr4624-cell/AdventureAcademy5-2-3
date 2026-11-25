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

/**
 * Output gain of the warp collapse ("섬광/충격", after `distort()`), measured in the browser against the HQ theme
 * (INTRO_ADVENTUREACADEMY.wav at its trimmed volume): 0.42 → 0.05 (−18.5 dB). The charge itself is unchanged.
 */
export const WARP_FLASH_LEVEL = 0.05;

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
      // Phase 3: the collapse used to jump to 0.42 through the tanh drive (≈ −11 dBFS RMS, 27 dB over the
      // HQ theme). It now rises from the current charge level to WARP_FLASH_LEVEL in 60 ms and fades as before.
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.linearRampToValueAtTime(WARP_FLASH_LEVEL, t + 0.06);
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

function oneShotVoice(out: GainNode, nodes: AudioNode[], sources: AudioScheduledSourceNode[], lifeMs: number) {
  const voice: Voice = { nodes, sources, out, timer: null };
  voices.add(voice);
  voice.timer = window.setTimeout(() => {
    [...voice.nodes, voice.out].forEach((node) => node.disconnect());
    voices.delete(voice);
  }, lifeMs);
}

/**
 * Phase 3 (Floor 2 start room): "화면 바깥에서 사람이 외치는 소리". No voice recording exists in the project, so a
 * short, muffled, distant call is synthesized (a gliding vocal tone through two formant filters, low-passed
 * for distance). Kept quiet (well under the warp/cart levels).
 */
export function playDistantShout(level = 0.16): void {
  const ctx = getContext();
  if (!ctx || !master || !noise) return;
  const now = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = level;
  out.connect(master);
  const nodes: AudioNode[] = [];
  const sources: AudioScheduledSourceNode[] = [];
  // two calls, the second a little higher ("여-기!")
  [[0, 0.42, 210], [0.5, 0.55, 250]].forEach(([offset, length, pitch]) => {
    const tone = ctx.createOscillator();
    tone.type = "sawtooth";
    tone.frequency.setValueAtTime(pitch * 0.92, now + offset);
    tone.frequency.linearRampToValueAtTime(pitch * 1.18, now + offset + length * 0.35);
    tone.frequency.linearRampToValueAtTime(pitch * 0.86, now + offset + length);
    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 6;
    const vibratoDepth = ctx.createGain();
    vibratoDepth.gain.value = pitch * 0.02;
    vibrato.connect(vibratoDepth);
    vibratoDepth.connect(tone.frequency);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.setValueAtTime(0.0001, now + offset);
    env.gain.linearRampToValueAtTime(1, now + offset + 0.06);
    env.gain.setValueAtTime(1, now + offset + length * 0.7);
    env.gain.exponentialRampToValueAtTime(0.0001, now + offset + length);
    const formantA = ctx.createBiquadFilter();
    formantA.type = "bandpass"; formantA.frequency.value = 760; formantA.Q.value = 5;
    const formantB = ctx.createBiquadFilter();
    formantB.type = "bandpass"; formantB.frequency.value = 1250; formantB.Q.value = 6;
    const distance = ctx.createBiquadFilter();
    distance.type = "lowpass"; distance.frequency.value = 1600;
    tone.connect(env);
    env.connect(formantA); env.connect(formantB);
    formantA.connect(distance); formantB.connect(distance);
    distance.connect(out);
    tone.start(now + offset); vibrato.start(now + offset);
    tone.stop(now + offset + length + 0.05); vibrato.stop(now + offset + length + 0.05);
    nodes.push(tone, vibrato, vibratoDepth, env, formantA, formantB, distance);
    sources.push(tone, vibrato);
  });
  oneShotVoice(out, nodes, sources, 1400);
}

/** Phase 3 (Floor 2 event 2): "발소리 sfx" — four soft footsteps in a nearby alley (low-passed noise taps). */
export function playFootsteps(level = 0.32): void {
  const ctx = getContext();
  if (!ctx || !master || !noise) return;
  const now = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = level;
  out.connect(master);
  const nodes: AudioNode[] = [];
  const sources: AudioScheduledSourceNode[] = [];
  [0, 0.34, 0.66, 0.99].forEach((offset, index) => {
    const step = ctx.createBufferSource();
    step.buffer = noise;
    const low = ctx.createBiquadFilter();
    low.type = "lowpass"; low.frequency.value = 520 - index * 30;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.setValueAtTime(0.0001, now + offset);
    env.gain.linearRampToValueAtTime(index % 2 === 0 ? 1 : 0.8, now + offset + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.16);
    step.connect(low); low.connect(env); env.connect(out);
    step.start(now + offset, index * 0.3); step.stop(now + offset + 0.2);
    nodes.push(step, low, env); sources.push(step);
  });
  oneShotVoice(out, nodes, sources, 1500);
}
