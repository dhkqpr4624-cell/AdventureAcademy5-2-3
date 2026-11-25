import { BGM_LOUDNESS_TRIM, BGM_URLS, fadeOutBgm, getActiveBgmId, getBgmDebugState, playBgm, stopBgm, type BgmTrackId } from "./game/audioBgm";
import { CHAPTER3_INTRO_PHASES } from "./data/chapter3/chapter3IntroStage";
import { DUNGEON7_RESCUE_BGM_RESTART_DELAY_MS, startDungeon7RescueBgm } from "./components/Dungeon7RescueStory";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[bgmFollowupChecks] ${message}`);
}

const BASECAMP_BGM = "assets/audio/bgm/basecamp-bgm.wav";
const REVIVE_ENDING_BGM = "assets/audio/bgm/revive-ending-scene.wav";
const SAVE_DENEB_BGM = "assets/audio/bgm/save-deneb-dungeon7.wav";
const UNIT3_HQ_BGM = "assets/audio/bgm/intro-adventureacademy.wav";
const UNIT3_BASECAMP_BGM = "assets/audio/bgm/unit3-basecamp.wav";

/** Minimal HTMLAudioElement stand-in that records what the BGM manager does with it. */
class FakeAudio {
  static instances: FakeAudio[] = [];
  src: string;
  preload = "";
  volume = 1;
  loop = false;
  paused = true;
  currentTime = 0;
  playCalls = 0;
  onended: (() => void) | null = null;
  constructor(src: string) { this.src = src; FakeAudio.instances.push(this); }
  play() { this.playCalls += 1; this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  end() { this.paused = true; this.onended?.(); }
}

/** Runs `body` with fake Audio and fake window timers, restoring the real ones afterwards. */
function withFakeAudio(body: (clock: { pending: () => number; advance: (ms: number) => void }) => void): void {
  const scope = globalThis as unknown as Record<string, unknown>;
  const timerScope = window as unknown as Record<string, unknown>;
  const original = { Audio: scope.Audio, setTimeout: timerScope.setTimeout, clearTimeout: timerScope.clearTimeout, setInterval: timerScope.setInterval, clearInterval: timerScope.clearInterval };
  // Volume ramps (fade-in / fade-out / release) use intervals; they are recorded but never fire here.
  const intervals = new Set<number>();
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; callback: () => void }>();
  scope.Audio = FakeAudio;
  timerScope.setTimeout = (callback: () => void, delay = 0) => { const id = nextId++; timers.set(id, { at: now + delay, callback }); return id; };
  timerScope.clearTimeout = (id: number) => { timers.delete(id); };
  timerScope.setInterval = () => { const id = nextId++; intervals.add(id); return id; };
  timerScope.clearInterval = (id: number) => { intervals.delete(id); };
  const advance = (ms: number) => {
    const target = now + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      now = due[1].at;
      due[1].callback();
    }
    now = target;
  };
  FakeAudio.instances = [];
  try {
    stopBgm();
    body({ pending: () => timers.size, advance });
  } finally {
    stopBgm();
    scope.Audio = original.Audio;
    timerScope.setTimeout = original.setTimeout;
    timerScope.clearTimeout = original.clearTimeout;
    timerScope.setInterval = original.setInterval;
    timerScope.clearInterval = original.clearInterval;
    FakeAudio.instances = [];
  }
}

const playing = () => FakeAudio.instances.filter((audio) => !audio.paused);
const playCount = (audio: FakeAudio): number => audio.playCalls;

export function runBgmFollowupChecks(): void {
  // Mapping: only the three requested scenes move to the new files.
  const urls = BGM_URLS as Readonly<Record<BgmTrackId, string>>;
  assert(urls.village.endsWith(BASECAMP_BGM), "BaseCamp (village) must use basecamp-bgm.wav");
  assert(urls.reminiscence.endsWith(REVIVE_ENDING_BGM), "Dungeon3 reminiscence must use revive-ending-scene.wav");
  assert(urls["ending-credit"].endsWith(REVIVE_ENDING_BGM), "Dungeon10 ending must use revive-ending-scene.wav");
  assert(urls["save-deneb"].endsWith(SAVE_DENEB_BGM), "Dungeon7 rescue must use save-deneb-dungeon7.wav");
  const otherTracks = (Object.keys(urls) as BgmTrackId[]).filter((id) => !["village", "reminiscence", "ending-credit", "save-deneb", "unit3-hq", "unit3-basecamp", "unit3-dungeon"].includes(id));
  assert(otherTracks.join() === "airship,intro-story,dungeon,boss-battle,sacrifice,unit3-tension", "unexpected BGM track list");
  assert(urls["unit3-hq"].endsWith(UNIT3_HQ_BGM) && urls["unit3-tension"].endsWith("audio/intro-story-theme.wav"), "Unit 3 HQ / tension BGM files");
  assert(urls["unit3-basecamp"].endsWith(UNIT3_BASECAMP_BGM), "Unit 3 base camp BGM file");
  for (const id of otherTracks) {
    assert(![BASECAMP_BGM, REVIVE_ENDING_BGM, SAVE_DENEB_BGM, UNIT3_HQ_BGM, UNIT3_BASECAMP_BGM].some((file) => urls[id].endsWith(file)), `${id} must keep its original file`);
  }
  // Hotfix 2: the HQ theme is the only BGM cue of the HQ map; nothing switches it to the tension theme.
  const hqCues = Object.entries(CHAPTER3_INTRO_PHASES).flatMap(([name, phase]) => (phase.audio ?? []).filter((cue) => cue.startsWith("bgm-")).map((cue) => `${name}:${cue}`));
  assert(hqCues.join() === "hq-gather:bgm-hq", `HQ map BGM cues must be hq-gather only (got ${hqCues.join()})`);
  assert(BGM_LOUDNESS_TRIM["unit3-hq"] === 0.216 && BGM_LOUDNESS_TRIM["unit3-basecamp"] === 0.473 && BGM_LOUDNESS_TRIM.village === undefined, "per-track loudness trims");
  assert(DUNGEON7_RESCUE_BGM_RESTART_DELAY_MS === 2_500, "Dungeon7 rescue BGM replay delay must be 2500ms");

  // Dungeon7: ended -> 2.5s silence -> replay from 0, with one timer at most.
  withFakeAudio(({ pending, advance }) => {
    playBgm("dungeon", undefined, { loop: true, volume: 0.42 });
    const dungeon = FakeAudio.instances[0];
    const stopRescue = startDungeon7RescueBgm();
    const rescue = FakeAudio.instances[1];
    assert(dungeon.paused && rescue.src.endsWith(SAVE_DENEB_BGM) && !rescue.paused, "rescue BGM must replace the dungeon BGM");
    assert(rescue.loop === false && rescue.volume === 0.42 && rescue.playCalls === 1, "rescue BGM must not use native loop");
    rescue.currentTime = 99;
    rescue.end();
    assert(pending() === 1 && rescue.paused, "ended must schedule exactly one replay timer");
    advance(DUNGEON7_RESCUE_BGM_RESTART_DELAY_MS - 1);
    assert(rescue.paused && rescue.playCalls === 1, "replay must wait the full 2500ms");
    advance(1);
    assert(!rescue.paused && playCount(rescue) === 2 && rescue.currentTime === 0 && pending() === 0, "replay must restart from the beginning after 2500ms");
    rescue.end(); rescue.end();
    assert(pending() === 1, "repeated ended events must not stack timers");
    // Normal end / skip / unmount all run the same cleanup.
    stopRescue();
    assert(pending() === 0 && rescue.paused && getActiveBgmId() === null, "cleanup must stop the rescue BGM and its replay timer");
    advance(10_000);
    assert(playCount(rescue) === 2, "no replay after cleanup");
    // Dungeon7 -> BaseCamp: the new BaseCamp BGM starts exactly once.
    playBgm("village", undefined, { loop: true, volume: 0.42 });
    playBgm("village", undefined, { loop: true, volume: 0.42 });
    const village = FakeAudio.instances.filter((audio) => audio.src.endsWith(BASECAMP_BGM));
    assert(village.length === 1 && village[0].loop && village[0].volume === 0.42 && playing().length === 1, "BaseCamp BGM must start once with its existing loop/volume");
  });

  // Strict Mode: effect, cleanup, effect -> a single live audio and a single timer.
  withFakeAudio(({ pending }) => {
    const first = startDungeon7RescueBgm();
    first();
    const stopSecond = startDungeon7RescueBgm();
    const live = playing();
    assert(live.length === 1 && live[0].src.endsWith(SAVE_DENEB_BGM), "Strict Mode must leave exactly one playing rescue BGM");
    live[0].end();
    assert(pending() === 1, "Strict Mode must leave exactly one replay timer");
    stopSecond();
    assert(pending() === 0 && playing().length === 0, "Strict Mode cleanup must stop everything");
    // Re-entry starts a fresh lifecycle.
    const stopAgain = startDungeon7RescueBgm();
    assert(playing().length === 1 && getActiveBgmId() === "save-deneb", "re-entering the rescue story must restart the BGM");
    stopAgain();
  });

  // Dungeon3 reminiscence and Dungeon10 ending share the file but never the audio element.
  withFakeAudio(() => {
    playBgm("reminiscence", undefined, { volume: 0.42, restartDelayRangeMs: [1_000, 2_000], exclusive: true });
    const reminiscence = FakeAudio.instances[0];
    assert(reminiscence.src.endsWith(REVIVE_ENDING_BGM) && reminiscence.volume === 0.42 && !reminiscence.loop, "reminiscence keeps its delayed-loop rule");
    stopBgm("reminiscence");
    assert(reminiscence.paused && getActiveBgmId() === null, "reminiscence cleanup");
    playBgm("ending-credit", undefined, { loop: true, volume: 0.42 });
    const ending = FakeAudio.instances[1];
    assert(ending !== reminiscence && ending.src.endsWith(REVIVE_ENDING_BGM) && ending.loop && ending.volume === 0.42, "Dungeon10 ending gets its own looping audio element");
    playBgm("ending-credit", undefined, { loop: true, volume: 0.42 });
    assert(FakeAudio.instances.length === 2 && ending.playCalls === 1 && !ending.paused, "ending BGM must not restart from the top when requested again");
    stopBgm();
    assert(ending.paused && getActiveBgmId() === null, "title (stopBgm) must stop the ending BGM");
  });

  // Hotfix 2: HQ / base camp themes — single element, no restart on repeat requests, release fade on replace.
  withFakeAudio(() => {
    playBgm("unit3-hq", undefined, { loop: true, volume: 0.42 });
    playBgm("unit3-hq", undefined, { loop: true, volume: 0.42 });
    const hq = FakeAudio.instances.filter((audio) => audio.src.endsWith(UNIT3_HQ_BGM));
    assert(hq.length === 1 && hq[0].loop && hq[0].playCalls === 1 && Math.abs(hq[0].volume - 0.42 * 0.216) < 1e-9, "HQ BGM starts once, loops, trimmed volume");
    hq[0].currentTime = 37;
    playBgm("unit3-hq", undefined, { loop: true, volume: 0.42 });
    assert(hq[0].currentTime === 37 && FakeAudio.instances.length === 1, "a repeated HQ cue must not restart the theme");
    // fade requested for another id is ignored; for the HQ id it marks the fade
    void fadeOutBgm(1200, "unit3-basecamp");
    assert(!getBgmDebugState().fadingOut, "fadeOutBgm(id) ignores other tracks");
    void fadeOutBgm(1200, "unit3-hq");
    assert(getBgmDebugState().fadingOut, "fadeOutBgm marks the HQ theme as fading");
    // base camp replaces it: the HQ tail is released (fading), not left playing at full volume
    playBgm("unit3-basecamp", undefined, { loop: true, volume: 0.42 });
    const camp = FakeAudio.instances.filter((audio) => audio.src.endsWith(UNIT3_BASECAMP_BGM));
    assert(camp.length === 1 && getActiveBgmId() === "unit3-basecamp" && Math.abs(camp[0].volume - 0.42 * 0.473) < 1e-9, "base camp BGM trimmed volume");
    assert(getBgmDebugState().releasing.length === 1 && getBgmDebugState().releasing[0].id === "unit3-hq", "HQ theme releases with a fade");
    // re-entering the base camp while it fades out keeps the same element and brings it back
    void fadeOutBgm(1000);
    playBgm("unit3-basecamp", undefined, { loop: true, volume: 0.42 });
    assert(FakeAudio.instances.filter((audio) => audio.src.endsWith(UNIT3_BASECAMP_BGM)).length === 1 && !getBgmDebugState().fadingOut && !camp[0].paused, "base camp re-entry mid-fade must not duplicate or stop the theme");
    // dungeon replaces the base camp theme: one active track, the old one only as a release tail
    playBgm("dungeon", undefined, { loop: true, volume: 0.42 });
    assert(getActiveBgmId() === "dungeon" && getBgmDebugState().releasing.some((item) => item.id === "unit3-basecamp"), "dungeon entry releases the base camp theme");
    // title: everything stops, release tails included
    stopBgm();
    assert(playing().length === 0 && getBgmDebugState().releasing.length === 0, "stopBgm() stops release tails too");
  });
}
