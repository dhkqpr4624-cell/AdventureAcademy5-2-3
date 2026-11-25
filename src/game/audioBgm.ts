export type BgmTrackId =
  | "airship"
  | "intro-story"
  | "village"
  | "dungeon"
  | "boss-battle"
  | "sacrifice"
  | "reminiscence"
  | "ending-credit"
  | "save-deneb"
  | "unit3-hq"
  | "unit3-tension"
  | "unit3-basecamp"
  | "unit3-dungeon";

export type BgmOptions = {
  loop?: boolean;
  volume?: number;
  restartDelayMs?: number;
  restartDelayRangeMs?: readonly [number, number];
  exclusive?: boolean;
  /** Ramp the volume up from 0 over this many ms. */
  fadeInMs?: number;
};

export const BGM_URLS: Readonly<Record<BgmTrackId, string>> = {
  airship: `${import.meta.env.BASE_URL}assets/audio/airship-theme.wav`,
  "intro-story": `${import.meta.env.BASE_URL}assets/audio/intro-story-theme.wav`,
  village: `${import.meta.env.BASE_URL}assets/audio/bgm/basecamp-bgm.wav`,
  dungeon: `${import.meta.env.BASE_URL}assets/audio/dungeon-theme.wav`,
  "boss-battle": `${import.meta.env.BASE_URL}assets/audio/boss-battle-theme.wav`,
  sacrifice: `${import.meta.env.BASE_URL}assets/audio/sacrifice-theme.wav`,
  reminiscence: `${import.meta.env.BASE_URL}assets/audio/bgm/revive-ending-scene.wav`,
  "ending-credit": `${import.meta.env.BASE_URL}assets/audio/bgm/revive-ending-scene.wav`,
  "save-deneb": `${import.meta.env.BASE_URL}assets/audio/bgm/save-deneb-dungeon7.wav`,
  // Unit 3 intro: Adventure Academy HQ theme (whole HQ map, through the warp) and the legacy tense portal theme.
  "unit3-hq": `${import.meta.env.BASE_URL}assets/audio/bgm/intro-adventureacademy.wav`,
  "unit3-tension": `${import.meta.env.BASE_URL}assets/audio/intro-story-theme.wav`,
  // Unit 3 base camp theme.
  "unit3-basecamp": `${import.meta.env.BASE_URL}assets/audio/bgm/unit3-basecamp.wav`,
  // Phase 3 hotfix: Unit 3 dungeon theme (Floors 1–2; per-floor tracks can be mapped in UNIT3_DUNGEON_BGM_BY_FLOOR).
  "unit3-dungeon": `${import.meta.env.BASE_URL}assets/audio/bgm/unit3-dungeon.wav`,
};

/**
 * Per-track loudness trim, multiplied into the requested volume. The WAV files stay byte-identical;
 * the trim brings each master to the integrated loudness of the existing BGM set (basecamp-bgm.wav,
 * -25.5 LUFS) so every scene keeps its SFX balance at the shared 0.42 volume.
 *   intro-adventureacademy.wav  -12.2 LUFS  ->  10^((-25.5 + 12.2) / 20) = 0.216
 *   unit3-basecamp.wav          -19.0 LUFS  ->  10^((-25.5 + 19.0) / 20) = 0.473
 *   unit3-dungeon.wav           -15.8 LUFS  ->  10^((-25.5 + 15.8) / 20) = 0.327   (Phase 3 hotfix)
 */
export const BGM_LOUDNESS_TRIM: Readonly<Partial<Record<BgmTrackId, number>>> = {
  "unit3-hq": 0.216,
  "unit3-basecamp": 0.473,
  "unit3-dungeon": 0.327,
};

/**
 * Loop region [start, end] in seconds for looping tracks whose master has silence around the music
 * (the file itself is untouched). Playback starts at `start`; on reaching `end` it jumps back to `start`.
 *   unit3-dungeon.wav: 1.43 s of digital silence before the first note → start 1.40 s; the reverb tail is kept
 *   until it falls below -60 dBFS (118.2 s; the file runs to 119.6 s) → end 118.2 s.
 */
export const BGM_LOOP_REGIONS: Readonly<Partial<Record<BgmTrackId, readonly [number, number]>>> = {
  "unit3-dungeon": [1.4, 118.2],
};

/** When another track replaces one of these, the outgoing track fades out over this many ms instead of cutting. */
const BGM_RELEASE_MS: Readonly<Partial<Record<BgmTrackId, number>>> = {
  "unit3-hq": 1000,
  "unit3-basecamp": 1000,
  "unit3-dungeon": 1000,
};

export function effectiveBgmVolume(id: BgmTrackId, volume = 0.42): number {
  return Math.max(0, Math.min(1, volume * (BGM_LOUDNESS_TRIM[id] ?? 1)));
}

type ActiveBgm = {
  id: BgmTrackId;
  audio: HTMLAudioElement;
  restartDelayMs: number;
  restartDelayRangeMs?: readonly [number, number];
  exclusive: boolean;
  restartTimer: number | null;
  rampTimer: number | null;
  targetVolume: number;
  /** true while fadeOutBgm() ramps this entry to silence (it will be disposed at the end). */
  fadingOut: boolean;
};

let activeBgm: ActiveBgm | null = null;
/** Replaced tracks that are still releasing (fading out). Never more than a short tail; stopBgm() kills them. */
const releasing = new Set<ActiveBgm>();
let gestureListenersInstalled = false;

function tryPlayActive(): void {
  if (!activeBgm || !activeBgm.audio.paused) return;
  void activeBgm.audio.play().catch(() => undefined);
}

function installGestureRetry(): void {
  if (gestureListenersInstalled || typeof document === "undefined") return;
  gestureListenersInstalled = true;
  const retry = () => tryPlayActive();
  document.addEventListener("pointerdown", retry, { passive: true });
  document.addEventListener("keydown", retry);
}

function disposeEntry(entry: ActiveBgm): void {
  if (entry.restartTimer !== null) window.clearTimeout(entry.restartTimer);
  if (entry.rampTimer !== null) window.clearInterval(entry.rampTimer);
  entry.restartTimer = null;
  entry.rampTimer = null;
  entry.audio.onended = null;
  entry.audio.ontimeupdate = null;
  entry.audio.onloadedmetadata = null;
  entry.audio.pause();
  entry.audio.currentTime = 0;
  releasing.delete(entry);
}

function disposeReleasing(): void {
  for (const entry of [...releasing]) disposeEntry(entry);
}

/** Drops the active track: cut, or — for tracks with a release time — a short fade-out tail. */
function disposeActive(allowRelease = false): void {
  const entry = activeBgm;
  if (!entry) return;
  activeBgm = null;
  const releaseMs = allowRelease ? BGM_RELEASE_MS[entry.id] ?? 0 : 0;
  if (releaseMs > 0 && !entry.audio.paused) {
    if (entry.restartTimer !== null) window.clearTimeout(entry.restartTimer);
    entry.restartTimer = null;
    entry.audio.onended = null;
    releasing.add(entry);
    rampVolume(entry, 0, releaseMs, () => disposeEntry(entry));
    return;
  }
  disposeEntry(entry);
}

export function playBgm(
  id: BgmTrackId,
  url = BGM_URLS[id],
  options: BgmOptions = {},
): void {
  if (typeof Audio === "undefined") return;
  if (activeBgm?.exclusive && activeBgm.id !== id) return;
  if (activeBgm?.id === id) {
    // Requested again while it fades out (e.g. re-entering a scene mid-fade): keep the same element and bring it back.
    if (activeBgm.fadingOut) {
      activeBgm.fadingOut = false;
      rampVolume(activeBgm, activeBgm.targetVolume, Math.max(300, options.fadeInMs ?? 600));
    }
    tryPlayActive();
    return;
  }

  disposeActive(true);
  const audio = new Audio(url);
  const restartDelayMs = Math.max(0, options.restartDelayMs ?? 0);
  const restartDelayRangeMs = options.restartDelayRangeMs;
  audio.preload = "auto";
  const targetVolume = effectiveBgmVolume(id, options.volume ?? 0.42);
  audio.volume = options.fadeInMs ? 0 : targetVolume;
  audio.loop = Boolean(options.loop) && restartDelayMs === 0;
  activeBgm = { id, audio, restartDelayMs, restartDelayRangeMs, exclusive: Boolean(options.exclusive), restartTimer: null, rampTimer: null, targetVolume, fadingOut: false };
  if (options.fadeInMs) rampVolume(activeBgm, targetVolume, options.fadeInMs);

  const loopRegion = audio.loop ? BGM_LOOP_REGIONS[id] : undefined;
  if (loopRegion) {
    const [loopStart, loopEnd] = loopRegion;
    const toStart = () => { if (audio.currentTime < loopStart - 0.05) audio.currentTime = loopStart; };
    if (audio.readyState >= 1) toStart(); else audio.onloadedmetadata = toStart;
    audio.ontimeupdate = () => {
      if (audio.currentTime >= loopEnd || audio.currentTime < loopStart - 0.05) audio.currentTime = loopStart;
    };
  }

  if (restartDelayMs > 0 || restartDelayRangeMs) {
    audio.onended = () => {
      if (!activeBgm || activeBgm.audio !== audio) return;
      const [minimum, maximum] = restartDelayRangeMs ?? [restartDelayMs, restartDelayMs];
      const delay = Math.max(0, minimum) + Math.random() * Math.max(0, maximum - minimum);
      if (activeBgm.restartTimer !== null) window.clearTimeout(activeBgm.restartTimer);
      activeBgm.restartTimer = window.setTimeout(() => {
        if (!activeBgm || activeBgm.audio !== audio) return;
        activeBgm.restartTimer = null;
        audio.currentTime = 0;
        void audio.play().catch(() => undefined);
      }, delay);
    };
  }

  installGestureRetry();
  void audio.play().catch(() => undefined);
}

function rampVolume(entry: ActiveBgm, to: number, durationMs: number, onDone?: () => void): void {
  if (entry.rampTimer !== null) window.clearInterval(entry.rampTimer);
  const from = entry.audio.volume;
  const startedAt = performance.now();
  entry.rampTimer = window.setInterval(() => {
    const progress = Math.min(1, (performance.now() - startedAt) / Math.max(1, durationMs));
    entry.audio.volume = Math.max(0, Math.min(1, from + (to - from) * progress));
    if (progress >= 1) {
      if (entry.rampTimer !== null) window.clearInterval(entry.rampTimer);
      entry.rampTimer = null;
      onDone?.();
    }
  }, 40);
}

/** Fade the active BGM out and stop it. Resolves when it is silent (or immediately when nothing plays). */
export function fadeOutBgm(durationMs: number, id?: BgmTrackId): Promise<void> {
  const entry = activeBgm;
  if (!entry || (id && entry.id !== id)) return Promise.resolve();
  entry.fadingOut = true;
  return new Promise((resolve) => {
    rampVolume(entry, 0, durationMs, () => {
      if (activeBgm === entry && entry.fadingOut) disposeActive();
      resolve();
    });
  });
}

/**
 * Temporarily lowers the active track to `factor` x its target volume (e.g. under an important effect).
 * It keeps playing; the next fadeOutBgm() / track change takes it from there.
 */
export function duckBgm(factor: number, durationMs: number, id?: BgmTrackId): void {
  const entry = activeBgm;
  if (!entry || entry.fadingOut || (id && entry.id !== id)) return;
  rampVolume(entry, Math.max(0, Math.min(1, entry.targetVolume * factor)), durationMs);
}

/** Lower the active BGM, then start `id` with a fade-in (one track at a time, never overlapping twice). */
export function crossfadeBgm(id: BgmTrackId, fadeOutMs: number, options: BgmOptions = {}): Promise<void> {
  if (activeBgm?.id === id) return Promise.resolve();
  return fadeOutBgm(fadeOutMs).then(() => playBgm(id, undefined, options));
}

export function stopBgm(id?: BgmTrackId): void {
  if (!id) disposeReleasing();
  if (!activeBgm || (id && activeBgm.id !== id)) return;
  disposeActive();
}

export function getActiveBgmId(): BgmTrackId | null {
  return activeBgm?.id ?? null;
}

export type BgmDebugState = {
  id: BgmTrackId | null;
  src: string | null;
  paused: boolean | null;
  loop: boolean | null;
  volume: number | null;
  targetVolume: number | null;
  currentTime: number | null;
  fadingOut: boolean;
  releasing: { id: BgmTrackId; volume: number; paused: boolean }[];
};

/** Read-only snapshot of the BGM manager (used by the browser regression scripts). */
export function getBgmDebugState(): BgmDebugState {
  const entry = activeBgm;
  return {
    id: entry?.id ?? null,
    src: entry?.audio.src ?? null,
    paused: entry ? entry.audio.paused : null,
    loop: entry ? entry.audio.loop : null,
    volume: entry ? entry.audio.volume : null,
    targetVolume: entry?.targetVolume ?? null,
    currentTime: entry ? entry.audio.currentTime : null,
    fadingOut: entry?.fadingOut ?? false,
    releasing: [...releasing].map((item) => ({ id: item.id, volume: item.audio.volume, paused: item.audio.paused })),
  };
}

if (typeof window !== "undefined") {
  (window as unknown as { __aaBgmDebug?: () => BgmDebugState }).__aaBgmDebug = getBgmDebugState;
}
