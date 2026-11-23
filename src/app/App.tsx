import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { TitleScreen } from "../screens/TitleScreen/TitleScreen";
import type { ScreenId } from "./routes";
import { SaveManagementPanel } from "../components/SaveManagementPanel";
import { SaveManager } from "../save/SaveManager";
import { AutoSaveCoordinator } from "../save/AutoSaveCoordinator";
import { applySaveDataToGameState, createInitialGameSaveState, createSaveDataFromGameState, type GameSaveState } from "../save/saveStateAdapter";
import type { SaveReason } from "../save/saveTypes";
import { PlayerNamePopup } from "../components/PlayerNamePopup";
import { playRandomizedOneShot } from "../game/audioOneShot";
import { playBgm, stopBgm } from "../game/audioBgm";
import { stopAllChapter3Sfx } from "../game/audio/chapter3ProceduralSfx";
import { completeChapter3Intro, resolveContinueScreen } from "./chapter3Flow";

const StoryScreen = lazy(() => import("../screens/StoryScreen/StoryScreen").then((module) => ({ default: module.StoryScreen })));
const Chapter3BaseCampScreen = lazy(() => import("../screens/Chapter3BaseCamp/Chapter3BaseCampScreen").then((module) => ({ default: module.Chapter3BaseCampScreen })));

const BUTTON_CLICK_SFX_URL = `${import.meta.env.BASE_URL}assets/audio/button-clicked-sfx.mp3`;

/**
 * Unit 3 (5학년 2학기 3단원) — Phase 1 flow:
 * title → new game → name → intro (작전본부 → 던전 도착) → base camp.
 * Dungeon / question / boss screens are kept in the codebase as reusable systems but are not routed in Phase 1.
 */
export function App() {
  const loaded = useRef(SaveManager.load());
  const initial = useRef(loaded.current.success ? applySaveDataToGameState(loaded.current.data) : createInitialGameSaveState());
  const [currentScreen, setCurrentScreen] = useState<ScreenId>("title");
  const [game, setGame] = useState<GameSaveState>(initial.current);
  const gameRef = useRef(game);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [namePopupOpen, setNamePopupOpen] = useState(false);
  const [saveMessage, setSaveMessage] = useState(loaded.current.success && loaded.current.source !== "main" ? "메인 세이브가 손상되어 최근 백업을 복구했습니다." : "");
  const startedAtRef = useRef(Date.now());
  const coordinatorRef = useRef<AutoSaveCoordinator | null>(null);
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
  const navigate = useCallback((screen: ScreenId) => {
    if (screen !== "story") stopAllChapter3Sfx(250);
    // Phase 1 has no dungeon/question route: anything else falls back to the title.
    setCurrentScreen(screen === "story" || screen === "baseCamp" ? screen : "title");
    if (screen === "baseCamp") requestSave("baseCampEntered");
  }, [requestSave]);
  const hydrate = (data: ReturnType<typeof snapshot>) => {
    commitGame(applySaveDataToGameState(data));
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
      playBgm("village", undefined, { loop: true, volume: 0.42, fadeInMs: 1500 });
      return;
    }
    if (currentScreen === "title") {
      stopBgm();
      stopAllChapter3Sfx(200);
    }
    // The intro (story) drives its own BGM / ambience through the chapter3 stage.
  }, [currentScreen]);

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
      case "baseCamp": return <Chapter3BaseCampScreen playerState={game.playerState} onNavigate={navigate} />;
      default: return <TitleScreen
        onOpenSettings={() => setSettingsOpen(true)}
        hasSave={SaveManager.load().success}
        onContinue={() => {
          const latest = SaveManager.load();
          const state = latest.success ? applySaveDataToGameState(latest.data) : gameRef.current;
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

