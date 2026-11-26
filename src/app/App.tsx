import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { TitleScreen } from "../screens/TitleScreen/TitleScreen";
import { UNIT3_DEBUG_FLOORS, createUnit3DebugStart } from "../debug/unit3DebugStart";
import { isSaveDebugSession, setSaveDebugSession } from "../save/SaveManager";
import type { DungeonFloorRunState } from "../game/dungeon/dungeonTypes";
import type { ScreenId } from "./routes";
import { SaveManagementPanel } from "../components/SaveManagementPanel";
import { SaveManager } from "../save/SaveManager";
import { AutoSaveCoordinator } from "../save/AutoSaveCoordinator";
import { applySaveDataToGameState, createInitialGameSaveState, createSaveDataFromGameState, type GameSaveState } from "../save/saveStateAdapter";
import type { SaveReason } from "../save/saveTypes";
import { PlayerNamePopup } from "../components/PlayerNamePopup";
import { playRandomizedOneShot } from "../game/audioOneShot";
import { fadeOutBgm, playBgm, stopBgm, type BgmTrackId } from "../game/audioBgm";
import { stopAllChapter3Sfx } from "../game/audio/chapter3ProceduralSfx";
import { completeChapter3Intro, resolveContinueScreen } from "./chapter3Flow";
import type { SetStateAction } from "react";
import { UNIT3_FLOOR1_FLAGS, UNIT3_FLOOR1_ID, UNIT3_FLOOR1_QUEST_ID, finishUnit3Floor1Run, markUnit3Flag } from "../game/chapter3/unit3Floor1";
import { UNIT3_FLOOR2_FLAGS, UNIT3_FLOOR2_ID, UNIT3_FLOOR2_QUEST_ID, finishUnit3Floor2Run } from "../game/chapter3/unit3Floor2";
import { UNIT3_FLOOR3_FLAGS, UNIT3_FLOOR3_ID, UNIT3_FLOOR3_QUEST_ID, finishUnit3Floor3Run } from "../game/chapter3/unit3Floor3";
import { migrateUnit3SpecialRewards, recordUnit3CorrectAnswer } from "../game/chapter3/unit3Achievements";

/** Save → game state, with the Phase 3 hotfix special-reward migration (idempotent, never removes anything). */
const loadGameState = (data: Parameters<typeof applySaveDataToGameState>[0]): GameSaveState =>
  migrateUnit3SpecialRewards(applySaveDataToGameState(data));

/** Unit 3 floors routed from the base camp (Phase 3: Floor 1 and Floor 2). */
/** `bgm`: the floor's dungeon theme (Phase 3 hotfix: one shared track for Floors 1–2; set per floor later). */
const UNIT3_DUNGEON_FLOORS = {
  [UNIT3_FLOOR1_ID]: { questId: UNIT3_FLOOR1_QUEST_ID, finalFlag: UNIT3_FLOOR1_FLAGS.finalStory, finish: finishUnit3Floor1Run, bgm: "unit3-dungeon" },
  [UNIT3_FLOOR2_ID]: { questId: UNIT3_FLOOR2_QUEST_ID, finalFlag: UNIT3_FLOOR2_FLAGS.finalStory, finish: finishUnit3Floor2Run, bgm: "unit3-dungeon" },
  [UNIT3_FLOOR3_ID]: { questId: UNIT3_FLOOR3_QUEST_ID, finalFlag: UNIT3_FLOOR3_FLAGS.finalStory, finish: finishUnit3Floor3Run, bgm: "unit3-dungeon" },
} as const satisfies Record<string, { bgm: BgmTrackId } & Record<string, unknown>>;
type Unit3DungeonFloorId = keyof typeof UNIT3_DUNGEON_FLOORS;

const StoryScreen = lazy(() => import("../screens/StoryScreen/StoryScreen").then((module) => ({ default: module.StoryScreen })));
const DungeonScreen = lazy(() => import("../screens/DungeonScreen/DungeonScreen").then((module) => ({ default: module.DungeonScreen })));
const Chapter3BaseCampScreen = lazy(() => import("../screens/Chapter3BaseCamp/Chapter3BaseCampScreen").then((module) => ({ default: module.Chapter3BaseCampScreen })));

const BUTTON_CLICK_SFX_URL = `${import.meta.env.BASE_URL}assets/audio/button-clicked-sfx.mp3`;

/**
 * Unit 3 (5학년 2학기 3단원) — Phase 2 flow:
 * title → new game → name → intro (작전본부 → 던전 도착) → base camp ⇄ dungeon Floor 1.
 * Unit 2 floors stay in the codebase as reusable systems but are not routed from the Unit 3 base camp.
 */
export function App() {
  const loaded = useRef(SaveManager.load());
  const initial = useRef(loaded.current.success ? loadGameState(loaded.current.data) : createInitialGameSaveState());
  const [currentScreen, setCurrentScreen] = useState<ScreenId>("title");
  /** Floor opened by the next "dungeon" navigation (chosen at the base camp entrance). */
  const [dungeonFloorId, setDungeonFloorId] = useState<Unit3DungeonFloorId>(UNIT3_FLOOR1_ID);
  const dungeonFloorRef = useRef<Unit3DungeonFloorId>(UNIT3_FLOOR1_ID);
  const [game, setGame] = useState<GameSaveState>(initial.current);
  const gameRef = useRef(game);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [namePopupOpen, setNamePopupOpen] = useState(false);
  const [saveMessage, setSaveMessage] = useState(loaded.current.success && loaded.current.source !== "main" ? "메인 세이브가 손상되어 최근 백업을 복구했습니다." : "");
  const startedAtRef = useRef(Date.now());
  const coordinatorRef = useRef<AutoSaveCoordinator | null>(null);
  /** Phase 4 hotfix · Debug 후반: the prepared run restored once by the next DungeonScreen mount. */
  const debugFloorRunRef = useRef<DungeonFloorRunState | null>(null);
  gameRef.current = game;

  const snapshot = useCallback(() => createSaveDataFromGameState({
    ...gameRef.current,
    playTimeSeconds: gameRef.current.playTimeSeconds + Math.floor((Date.now() - startedAtRef.current) / 1000),
  }), []);
  const requestSave = useCallback((reason: SaveReason, immediate = false) => {
    if (immediate) coordinatorRef.current?.flush(reason);
    else coordinatorRef.current?.requestSave(reason);
  }, []);
  /** Replace the game state synchronously (ref first) so an immediate save sees it. */
  const commitGame = useCallback((next: GameSaveState) => {
    gameRef.current = next;
    setGame(next);
  }, []);
  /** Functional update against the latest state (ref first, so an immediate save sees it). */
  const updateGame = useCallback((update: (current: GameSaveState) => GameSaveState) => {
    commitGame(update(gameRef.current));
  }, [commitGame]);
  const navigate = useCallback((screen: ScreenId) => {
    if (screen !== "story") stopAllChapter3Sfx(250);
    if (screen !== "dungeon") debugFloorRunRef.current = null;
    // Unit 3 routes: intro story, base camp and the Floor 1 dungeon; anything else falls back to the title.
    const dungeonAllowed = screen === "dungeon" && gameRef.current.floorUnlockState.unlockedFloorIds.includes(dungeonFloorRef.current);
    setCurrentScreen(screen === "story" || screen === "baseCamp" || dungeonAllowed ? screen : "title");
    if (screen === "baseCamp") requestSave("baseCampEntered");
  }, [requestSave]);
  const hydrate = (data: ReturnType<typeof snapshot>) => {
    commitGame(loadGameState(data));
    startedAtRef.current = Date.now(); setCurrentScreen("title");
  };
  const reset = () => {
    commitGame(createInitialGameSaveState());
    startedAtRef.current = Date.now(); setSettingsOpen(false); setCurrentScreen("title");
  };

  useEffect(() => {
    coordinatorRef.current = new AutoSaveCoordinator(snapshot, (result) => {
      if (!result.success) {
        if (import.meta.env.DEV) console.warn("[Save] non-fatal save failure", result);
        setSaveMessage((current) => current || "자동 저장에 실패했습니다. 게임은 계속 진행할 수 있습니다.");
      }
    });
    const interval = window.setInterval(() => requestSave("interval"), 30_000);
    const visibility = () => { if (document.visibilityState === "hidden") requestSave("visibilityHidden", true); };
    const pagehide = () => requestSave("pageHide", true);
    document.addEventListener("visibilitychange", visibility); window.addEventListener("pagehide", pagehide);
    return () => {
      window.clearInterval(interval); document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", pagehide); coordinatorRef.current?.dispose(); coordinatorRef.current = null;
    };
  }, [requestSave, snapshot]);

  useEffect(() => {
    const playButtonClick = (event: MouseEvent) => {
      if (event.detail === 0 || !(event.target instanceof Element)) return;
      const button = event.target.closest("button");
      if (!button || button.disabled) return;
      playRandomizedOneShot(BUTTON_CLICK_SFX_URL);
    };
    document.addEventListener("click", playButtonClick, true);
    return () => document.removeEventListener("click", playButtonClick, true);
  }, []);

  useEffect(() => {
    if (currentScreen === "baseCamp") {
      // Base camp theme: loops through NPC talk, the shop and quest dialogue (all overlays on this screen).
      // Entering the dungeon fades it out (1.2 s, below); returning / continuing starts it again.
      playBgm("unit3-basecamp", undefined, { loop: true, volume: 0.42, fadeInMs: 1500 });
      return;
    }
    if (currentScreen === "title") {
      stopBgm();
      stopAllChapter3Sfx(200);
      if (isSaveDebugSession()) {
        // Leaving a Debug session: drop the debug state and go back to the real save (never written meanwhile).
        setSaveDebugSession(false);
        debugFloorRunRef.current = null;
        const latest = SaveManager.load();
        commitGame(latest.success ? loadGameState(latest.data) : createInitialGameSaveState());
      }
      return;
    }
    if (currentScreen === "dungeon") {
      // Phase 3 hotfix: dungeon theme. It starts on entry (the camp theme releases over 1 s while it fades in) and
      // loops through exploration, normal / elite fights, story events, illustrations and "다시 도전하기" — all of
      // those stay on this screen, and playBgm() never restarts the active track. Returning to the base camp
      // starts the camp theme, which fades this one out; the title stops everything.
      playBgm(UNIT3_DUNGEON_FLOORS[dungeonFloorId].bgm, undefined, { loop: true, volume: 0.42, fadeInMs: 1800 });
      return;
    }
    // Leaving the base camp for the intro story: the camp theme fades out instead of carrying into the story.
    void fadeOutBgm(1200, "unit3-basecamp");
    // The intro (story) drives its own BGM / ambience through the chapter3 stage.
  }, [currentScreen, dungeonFloorId]);

  const content = (() => {
    switch (currentScreen) {
      case "story": return <StoryScreen
        key={`intro-${game.playerState.name}`}
        playerName={game.playerState.name ?? ""}
        onNavigate={navigate}
        onStoryStarted={() => requestSave("storyStarted")}
        onStoryCompleted={() => {
          // Completion flag + player name are committed to the ref and written in the same tick,
          // then the base camp is shown. A reload afterwards resumes at the base camp.
          commitGame(completeChapter3Intro(gameRef.current));
          requestSave("introCompleted", true);
          setCurrentScreen("baseCamp");
        }}
      />;
      case "baseCamp": return <Chapter3BaseCampScreen game={game} updateGame={updateGame} requestSave={requestSave} onNavigate={navigate}
        onEnterDungeon={(floorId) => { dungeonFloorRef.current = floorId; setDungeonFloorId(floorId); navigate("dungeon"); }} />;
      case "dungeon": {
        const floorId = dungeonFloorId;
        const floor = UNIT3_DUNGEON_FLOORS[floorId];
        const applyState = <T,>(value: SetStateAction<T>, current: T): T => typeof value === "function" ? (value as (previous: T) => T)(current) : value;
        return <DungeonScreen
          key={floorId}
          floorId={floorId}
          onNavigate={navigate}
          playerState={game.playerState}
          setPlayerState={(value) => updateGame((current) => ({ ...current, playerState: applyState(value, current.playerState) }))}
          inventoryState={game.inventoryState}
          setInventoryState={(value) => updateGame((current) => ({ ...current, inventoryState: applyState(value, current.inventoryState) }))}
          onInventoryChanged={() => requestSave("itemAcquired")}
          onGoldAwarded={() => requestSave("itemAcquired")}
          onDungeonEntered={() => { updateGame((current) => ({ ...current, currentFloorId: floorId })); requestSave("dungeonEntered"); }}
          onDungeonAbandoned={(reason) => updateGame((current) => ({
            ...current,
            currentFloorId: null,
            currentFloorRun: null,
            playerState: reason === "defeat" ? { ...current.playerState, currentHp: current.playerState.maxHp } : current.playerState,
          }))}
          // Every entry starts a fresh run; persisted story flags keep finished events from replaying.
          savedFloorRun={debugFloorRunRef.current?.floorId === floorId ? debugFloorRunRef.current : null}
          onFloorRunChanged={() => undefined}
          firstObjectiveEventSeen={Boolean(game.firstObjectiveEventSeen[floor.finalFlag])}
          floor1StartStorySeen
          storyFlags={game.firstObjectiveEventSeen}
          onStoryEventSeen={(eventId) => { updateGame((current) => markUnit3Flag(current, eventId)); requestSave("storyCompleted", true); }}
          onCollectionRunReset={() => undefined}
          // Phase 3 hotfix: Unit 3 counts distinct correct question ids per floor (unit3Achievements.ts);
          // the Unit 2 per-run best (`floorBestCorrect`) is no longer written, so old saves keep their legacy value.
          onObjectiveAcquired={() => undefined}
          onBestCorrect={() => undefined}
          onQuestionCorrect={(questionId) => {
            const before = gameRef.current;
            const next = recordUnit3CorrectAnswer(before, floorId, questionId);
            if (next !== before) { commitGame(next); requestSave("itemAcquired"); }
          }}
          floorQuestStarted={game.questState[floor.questId] === "active" || game.questState[floor.questId] === "completed"}
          floorQuestStatus={game.questState[floor.questId] ?? "locked"}
          onFloorCleared={() => { updateGame((current) => floor.finish(current)); requestSave("floorCleared", true); }}
          onDungeon10EndingStarted={() => undefined}
          onDungeon10EndingComplete={() => undefined}
        />;
      }
      default: return <TitleScreen
        onOpenSettings={() => setSettingsOpen(true)}
        hasSave={SaveManager.load().success}
        debugFloors={UNIT3_DEBUG_FLOORS}
        onDebugStart={(floorId, phase) => {
          const start = createUnit3DebugStart(floorId as Unit3DungeonFloorId, phase);
          setSaveDebugSession(true); // from here every save goes to the debug session key only
          commitGame(start.state);
          startedAtRef.current = Date.now();
          debugFloorRunRef.current = start.floorRun;
          if (start.floorRun) {
            dungeonFloorRef.current = floorId as Unit3DungeonFloorId; setDungeonFloorId(floorId as Unit3DungeonFloorId);
            setCurrentScreen("dungeon");
          } else setCurrentScreen("baseCamp");
        }}
        onContinue={() => {
          const latest = SaveManager.load();
          const state = latest.success ? loadGameState(latest.data) : gameRef.current;
          commitGame(state);
          startedAtRef.current = Date.now();
          const next = resolveContinueScreen(state);
          if (next === "name") setNamePopupOpen(true);
          else setCurrentScreen(next);
        }}
        onNewGame={() => {
          if (SaveManager.load().success && !window.confirm("기존 모험 기록이 있습니다.\n새로 시작하면 현재 기록이 초기화됩니다.\n\n새로 시작하시겠습니까?")) return;
          SaveManager.clear(); commitGame(createInitialGameSaveState());
          startedAtRef.current = Date.now(); setNamePopupOpen(true);
        }} />;
    }
  })();
  return <><Suspense fallback={<div className="screen-loading" role="status">화면을 불러오는 중입니다.</div>}>{content}</Suspense>{namePopupOpen && <PlayerNamePopup onCancel={() => setNamePopupOpen(false)} onConfirm={(name) => {
    const nextPlayer = { ...gameRef.current.playerState, name };
    commitGame({ ...gameRef.current, playerState: nextPlayer });
    setNamePopupOpen(false); setCurrentScreen("story"); requestSave("manual", true);
  }} />}{settingsOpen && <SaveManagementPanel currentData={snapshot} onImport={hydrate} onReset={reset} onClose={() => setSettingsOpen(false)} />}{saveMessage && <div className="save-toast" role="status" onClick={() => setSaveMessage("")}>{saveMessage}</div>}</>;
}

