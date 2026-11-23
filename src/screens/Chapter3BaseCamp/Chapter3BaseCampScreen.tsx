import { useMemo, useRef } from "react";
import type { ScreenId } from "../../app/routes";
import { PlayerStatusBar } from "../../components/PlayerStatusBar";
import type { PlayerState } from "../../game/player/playerState";
import { CHAPTER3_BASE_CAMP_MAP, createChapter3BaseCampNpcs } from "../../data/chapter3/chapter3BaseCamp";
import { BaseCampViewport, type BaseCampViewportController } from "../BaseCampScreen/BaseCampViewport";

/**
 * Unit 3 base camp — Phase 1 arrival. Reuses the shared base camp viewport (cover scaling, camera clamp,
 * layered world). Dungeon entry, quests, shop and Unit 2 NPC events are intentionally not wired here.
 */
export function Chapter3BaseCampScreen({ playerState, onNavigate }: {
  playerState: PlayerState;
  onNavigate: (screen: ScreenId) => void;
}) {
  const viewportRef = useRef<BaseCampViewportController>(null);
  const npcViews = useMemo(() => createChapter3BaseCampNpcs(), []);
  return (
    <main className="game-screen base-camp-screen chapter3-base-camp-screen" data-testid="chapter3-base-camp">
      <BaseCampViewport
        ref={viewportRef}
        map={CHAPTER3_BASE_CAMP_MAP}
        mode="play"
        focusPointId="campCenter"
        selectedRegionId={null}
        onSelectRegion={() => undefined}
        interactionsDisabled
        npcViews={npcViews}
      />
      <aside className="current-quest-tracker chapter3-camp-status" aria-live="polite">
        <p className="eyebrow">베이스캠프</p>
        <strong>진입 지점 거점</strong>
        <span>데네브, 카이든과 함께 던전 탐색을 준비하고 있습니다.</span>
        <small>던전 탐색은 다음 업데이트에서 열립니다.</small>
      </aside>
      <div className="chapter3-camp-hud">
        <PlayerStatusBar {...playerState} />
      </div>
      <button type="button" className="chapter3-title-return" onClick={() => onNavigate("title")}>처음 화면</button>
      <div className="chapter3-camp-arrival-fade" aria-hidden="true" />
    </main>
  );
}
