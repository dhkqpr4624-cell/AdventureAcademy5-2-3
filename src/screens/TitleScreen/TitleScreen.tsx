import { useEffect, useState } from "react";

export type TitleDebugFloor = { floorId: string; label: string; title: string };
type TitleScreenProps = {
  onOpenSettings: () => void;
  hasSave: boolean;
  onNewGame: () => void;
  onContinue: () => void;
  /** Phase 4 hotfix · Debug Mode (hidden until Ctrl+Shift+D). */
  debugFloors?: readonly TitleDebugFloor[];
  onDebugStart?: (floorId: string, phase: "early" | "late") => void;
};

/** Title: the illustration already carries the ADVENTURE ACADEMY logo, so only the unit label is added. */
export function TitleScreen({ onOpenSettings, hasSave, onNewGame, onContinue, debugFloors = [], onDebugStart }: TitleScreenProps) {
  const [debugVisible, setDebugVisible] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugFloor, setDebugFloor] = useState<TitleDebugFloor | null>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && (event.key === "D" || event.key === "d" || event.code === "KeyD")) {
        event.preventDefault();
        setDebugVisible((visible) => !visible);
        setDebugOpen(false); setDebugFloor(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <main className="game-screen title-screen">
      <img
        className="title-background"
        src={`${import.meta.env.BASE_URL}assets/title/chapter3-title.png`}
        alt=""
        aria-hidden="true"
        draggable={false}
      />

      <button className="title-settings-button" type="button" onClick={onOpenSettings}>
        설정
      </button>

      {debugVisible && onDebugStart && (
        <div className="title-debug" data-testid="title-debug">
          <button type="button" className="title-debug-toggle" onClick={() => { setDebugOpen((open) => !open); setDebugFloor(null); }}>Debug</button>
          {debugOpen && (
            <div className="title-debug-panel" role="dialog" aria-label="Debug Mode">
              <p className="title-debug-note">Debug 플레이는 일반 세이브에 저장되지 않습니다.</p>
              {!debugFloor ? debugFloors.map((floor) => (
                <button key={floor.floorId} type="button" onClick={() => setDebugFloor(floor)}>{floor.label} · {floor.title}</button>
              )) : (
                <>
                  <strong>{debugFloor.label} · {debugFloor.title}</strong>
                  <button type="button" onClick={() => onDebugStart(debugFloor.floorId, "early")}>초반</button>
                  <button type="button" onClick={() => onDebugStart(debugFloor.floorId, "late")}>후반</button>
                  <button type="button" className="title-debug-back" onClick={() => setDebugFloor(null)}>뒤로</button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <section className="title-primary-controls" aria-label="게임 시작 메뉴">
        <p className="title-unit-label">&lt;5학년 2학기 3단원&gt;</p>
        <div className="title-primary-buttons">
          <button type="button" onClick={onNewGame}>
            새로 시작하기
          </button>
          <button type="button" disabled={!hasSave} onClick={onContinue}>
            이어하기
          </button>
        </div>
      </section>
    </main>
  );
}
