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
  | "unit3-tension";

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
  // Unit 3 intro: academy HQ theme (Unit 1 academy village theme) and the tense portal theme.
  "unit3-hq": `${import.meta.env.BASE_URL}assets/audio/village-theme.wav`,
  "unit3-tension": `${import.meta.env.BASE_URL}assets/audio/intro-story-theme.wav`,
};

type ActiveBgm = {
  id: BgmTrackId;
  audio: HTMLAudioElement;
  restartDelayMs: number;
  restartDelayRangeMs?: readonly [number, number];
  exclusive: boolean;
  restartTimer: number | null;
  rampTimer: number | null;
  targetVolume: number;
};

let activeBgm: ActiveBgm | null = null;
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

function disposeActive(): void {
  if (!activeBgm) return;
  if (activeBgm.restartTimer !== null) window.clearTimeout(activeBgm.restartTimer);
  if (activeBgm.rampTimer !== null) window.clearInterval(activeBgm.rampTimer);
  activeBgm.audio.onended = null;
  activeBgm.audio.pause();
  activeBgm.audio.currentTime = 0;
  activeBgm = null;
}

export function playBgm(
  id: BgmTrackId,
  url = BGM_URLS[id],
  options: BgmOptions = {},
): void {
  if (typeof Audio === "undefined") return;
  if (activeBgm?.exclusive && activeBgm.id !== id) return;
  if (activeBgm?.id === id) {
    tryPlayActive();
    return;
  }

  disposeActive();
  const audio = new Audio(url);
  const restartDelayMs = Math.max(0, options.restartDelayMs ?? 0);
  const restartDelayRangeMs = options.restartDelayRangeMs;
  audio.preload = "auto";
  const targetVolume = Math.max(0, Math.min(1, options.volume ?? 0.42));
  audio.volume = options.fadeInMs ? 0 : targetVolume;
  audio.loop = Boolean(options.loop) && restartDelayMs === 0;
  activeBgm = { id, audio, restartDelayMs, restartDelayRangeMs, exclusive: Boolean(options.exclusive), restartTimer: null, rampTimer: null, targetVolume };
  if (options.fadeInMs) rampVolume(activeBgm, targetVolume, options.fadeInMs);

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
  return new Promise((resolve) => {
    rampVolume(entry, 0, durationMs, () => {
      if (activeBgm === entry) disposeActive();
      resolve();
    });
  });
}

/** Lower the active BGM, then start `id` with a fade-in (one track at a time, never overlapping twice). */
export function crossfadeBgm(id: BgmTrackId, fadeOutMs: number, options: BgmOptions = {}): Promise<void> {
  if (activeBgm?.id === id) return Promise.resolve();
  return fadeOutBgm(fadeOutMs).then(() => playBgm(id, undefined, options));
}

export function stopBgm(id?: BgmTrackId): void {
  if (!activeBgm || (id && activeBgm.id !== id)) return;
  disposeActive();
}

export function getActiveBgmId(): BgmTrackId | null {
  return activeBgm?.id ?? null;
}
