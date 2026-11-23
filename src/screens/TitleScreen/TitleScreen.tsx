type TitleScreenProps = {
  onOpenSettings: () => void;
  hasSave: boolean;
  onNewGame: () => void;
  onContinue: () => void;
};

/** Title: the illustration already carries the ADVENTURE ACADEMY logo, so only the unit label is added. */
export function TitleScreen({ onOpenSettings, hasSave, onNewGame, onContinue }: TitleScreenProps) {
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
