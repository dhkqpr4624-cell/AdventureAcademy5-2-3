import { useEffect, useMemo, useRef, useState } from "react";
import type { ScreenId } from "../../app/routes";
import type { GameSaveState } from "../../save/saveStateAdapter";
import type { SaveReason } from "../../save/saveTypes";
import type { StorySequence } from "../../types/story";
import { CHAPTER3_BASE_CAMP_MAP, createChapter3BaseCampHitboxes, createChapter3BaseCampNpcs, type Chapter3CampTargetId } from "../../data/chapter3/chapter3BaseCamp";
import { BaseCampViewport, type BaseCampViewportController } from "../BaseCampScreen/BaseCampViewport";
import { StoryPlayer } from "../../game/story/StoryPlayer";
import { ShopPopup } from "../../components/ShopPopup";
import { InventoryPopup } from "../../components/InventoryPopup";
import { ItemIcon } from "../../components/ItemIcon";
import { NpcQuestMarker } from "../../components/NpcQuestMarker";
import { purchaseShopItem } from "../../game/inventory/shopResolver";
import { recalculatePlayerMaxHp } from "../../game/inventory/inventoryState";
import { getItemDefinition } from "../../game/inventory/itemDefinitions";
import {
  UNIT3_FLOOR1_ACHIEVEMENT, UNIT3_FLOOR1_FLAGS, UNIT3_FLOOR1_QUEST_ID, UNIT3_FLOOR1_QUEST_TITLE, UNIT3_FLOOR1_REWARD, UNIT3_FLOOR1_TITLE,
  acceptUnit3Floor1Quest, completeUnit3Floor1Quest, getUnit3Floor1QuestPhase, hasFlag, markUnit3Flag,
} from "../../game/chapter3/unit3Floor1";
import {
  UNIT3_FLOOR1_ACTIVE_REMINDER_STORY, UNIT3_FLOOR1_AFTER_COMPLETE_STORY, UNIT3_FLOOR1_BASE_CAMP_RETURN_STORY, UNIT3_FLOOR1_KAIDEN_ACTIVE_STORY,
  UNIT3_FLOOR1_KAIDEN_TALK_STORY, UNIT3_FLOOR1_QUEST_ACCEPTED_CHECKPOINT, UNIT3_FLOOR1_QUEST_COMPLETE_STORY, UNIT3_FLOOR1_QUEST_OFFER_STORY,
} from "../../data/chapter3/floor1Stories";

type Props = {
  game: GameSaveState;
  updateGame: (update: (current: GameSaveState) => GameSaveState) => void;
  requestSave: (reason: SaveReason, immediate?: boolean) => void;
  onNavigate: (screen: ScreenId) => void;
};

type ActiveStory = { sequence: StorySequence; kind: "offer" | "return" | "complete" | "talk" };

/**
 * Unit 3 base camp (Phase 2). Deneb, Kaiden, the supply crates and the dungeon entrance are clickable
 * (white pixel outline + pointer cursor on hover, hitboxes fitted to the visible pixels). The HP bar is not
 * shown here (dungeon only). The shop reuses the Unit 2 ShopPopup, inventory and gold logic unchanged.
 */
export function Chapter3BaseCampScreen({ game, updateGame, requestSave, onNavigate }: Props) {
  const viewportRef = useRef<BaseCampViewportController>(null);
  const npcViews = useMemo(() => createChapter3BaseCampNpcs(), []);
  const hitboxes = useMemo(() => createChapter3BaseCampHitboxes(npcViews), [npcViews]);
  const [hovered, setHovered] = useState<Chapter3CampTargetId | null>(null);
  const [story, setStory] = useState<ActiveStory | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [shopMessage, setShopMessage] = useState("");
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [achievementOpen, setAchievementOpen] = useState(false);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const questPhase = getUnit3Floor1QuestPhase(game);
  const flags = game.firstObjectiveEventSeen;
  const busy = story !== null || shopOpen || inventoryOpen || achievementOpen || rewardOpen;

  // Event I: first return after the final story — a short narration (민수 escorted to the protected area).
  useEffect(() => {
    if (hasFlag(flags, UNIT3_FLOOR1_FLAGS.finalStory) && !hasFlag(flags, UNIT3_FLOOR1_FLAGS.baseCampReturn)) {
      setStory({ sequence: UNIT3_FLOOR1_BASE_CAMP_RETURN_STORY, kind: "return" });
    }
    // Only on mount: the flag is written when the narration ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const openTarget = (target: Chapter3CampTargetId) => {
    if (busy) return;
    setHovered(null);
    if (target === "supply") { setShopMessage(""); setShopOpen(true); return; }
    if (target === "dungeonEntrance") {
      if (questPhase === "notAccepted") { setNotice("데네브와 먼저 이야기해 보세요."); return; }
      onNavigate("dungeon");
      return;
    }
    if (target === "deneb") {
      if (questPhase === "notAccepted") setStory({ sequence: UNIT3_FLOOR1_QUEST_OFFER_STORY, kind: "offer" });
      else if (questPhase === "readyToComplete") setStory({ sequence: UNIT3_FLOOR1_QUEST_COMPLETE_STORY, kind: "complete" });
      else if (questPhase === "active") setStory({ sequence: UNIT3_FLOOR1_ACTIVE_REMINDER_STORY, kind: "talk" });
      else setStory({ sequence: UNIT3_FLOOR1_AFTER_COMPLETE_STORY, kind: "talk" });
      return;
    }
    if (questPhase === "notAccepted") setStory({ sequence: UNIT3_FLOOR1_QUEST_OFFER_STORY, kind: "offer" });
    else if (questPhase === "completed") setStory({ sequence: UNIT3_FLOOR1_KAIDEN_TALK_STORY, kind: "talk" });
    else setStory({ sequence: UNIT3_FLOOR1_KAIDEN_ACTIVE_STORY, kind: "talk" });
  };

  const finishStory = () => {
    const current = story;
    setStory(null);
    if (!current) return;
    if (current.kind === "return") {
      updateGame((state) => markUnit3Flag(state, UNIT3_FLOOR1_FLAGS.baseCampReturn));
      requestSave("storyCompleted", true);
    } else if (current.kind === "complete") {
      setRewardOpen(true);
    } else {
      requestSave("npcDialogueCompleted");
    }
  };

  const claimReward = () => {
    updateGame((state) => completeUnit3Floor1Quest(state));
    requestSave("questCompleted", true);
  };

  const buyItem = (itemId: string) => {
    const result = purchaseShopItem(game.inventoryState, game.playerState.gold, itemId);
    if (!result.success) {
      setShopMessage(result.reason === "maxQuantity" ? "이미 최대 개수만큼 보유하고 있습니다." : "Gold가 부족합니다.");
      return;
    }
    updateGame((state) => ({ ...state, inventoryState: result.inventory, playerState: { ...state.playerState, gold: result.gold } }));
    setShopMessage("구매했습니다.");
    requestSave("shopUsed");
  };

  const marker = questPhase === "notAccepted" ? "available" : questPhase === "readyToComplete" ? "readyToComplete" : null;
  const rewardClaimed = Boolean(game.rewardClaimed[UNIT3_FLOOR1_QUEST_ID]);
  const hwando = getItemDefinition(UNIT3_FLOOR1_REWARD.weaponItemId)!;
  const smallPotion = getItemDefinition("potion-small")!;

  const overlay = (
    <>
      {(Object.keys(hitboxes) as Chapter3CampTargetId[]).map((target) => {
        const box = hitboxes[target];
        const label = target === "deneb" ? "데네브와 대화하기" : target === "kaiden" ? "카이든과 대화하기" : target === "supply" ? "보급물품 상점 열기" : "던전 입구로 들어가기";
        return (
          <button
            key={target}
            type="button"
            className={`chapter3-camp-hitbox hitbox-${target}`}
            style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
            disabled={busy}
            aria-label={label}
            onClick={() => openTarget(target)}
            onPointerEnter={() => setHovered(target)}
            onPointerLeave={() => setHovered((current) => current === target ? null : current)}
            onFocus={() => setHovered(target)}
            onBlur={() => setHovered((current) => current === target ? null : current)}
          >
            {target === "deneb" && marker && <NpcQuestMarker displayName="데네브" marker={marker} />}
          </button>
        );
      })}
    </>
  );

  return (
    <main className={`game-screen base-camp-screen chapter3-base-camp-screen ${hovered && !busy ? "is-hovering-target" : ""}`} data-testid="chapter3-base-camp">
      <BaseCampViewport
        ref={viewportRef}
        map={CHAPTER3_BASE_CAMP_MAP}
        mode="play"
        focusPointId="campCenter"
        selectedRegionId={null}
        onSelectRegion={() => undefined}
        interactionsDisabled
        npcViews={npcViews}
        viewHighlightId={busy ? null : hovered}
        worldOverlay={overlay}
      />
      <aside className="current-quest-tracker chapter3-camp-status" aria-live="polite">
        <p className="eyebrow">현재 퀘스트</p>
        {questPhase === "notAccepted" && <><strong>베이스캠프</strong><span>데네브가 이야기를 나누고 싶어 합니다.</span></>}
        {questPhase === "active" && <><strong>{UNIT3_FLOOR1_QUEST_TITLE}</strong><span>던전 1층 · {UNIT3_FLOOR1_TITLE}</span><small>진행 중</small></>}
        {questPhase === "readyToComplete" && <><strong>{UNIT3_FLOOR1_QUEST_TITLE}</strong><span>데네브에게 결과를 보고하세요.</span><small>완료 보고 가능</small></>}
        {questPhase === "completed" && <><strong>{UNIT3_FLOOR1_QUEST_TITLE}</strong><span>완료</span></>}
      </aside>
      {!story && (
        <div className="utility-button-row chapter3-utility-buttons">
          <button type="button" className="inventory-open-button" disabled={busy} onClick={() => setInventoryOpen(true)}>
            <img src={`${import.meta.env.BASE_URL}assets/ui/inventory.png`} alt="" aria-hidden="true" draggable={false} />
            <span className="visually-hidden">인벤토리</span>
          </button>
          <button type="button" className="achievement-open-button" disabled={busy} onClick={() => setAchievementOpen(true)}>
            <img src={`${import.meta.env.BASE_URL}assets/ui/achievement.png`} alt="" aria-hidden="true" draggable={false} />
            <span className="visually-hidden">업적</span>
          </button>
        </div>
      )}
      {notice && <div className="chapter3-camp-notice" role="status">{notice}</div>}
      {story && (
        <div className="base-camp-story-overlay chapter3-camp-story-overlay">
          <StoryPlayer
            key={story.sequence.id}
            sequence={story.sequence}
            playerName={game.playerState.name || "플레이어"}
            presentationMode="baseCampOverlay"
            onNavigate={() => undefined}
            onCheckpointReached={(_storyId, checkpointId) => {
              if (checkpointId !== UNIT3_FLOOR1_QUEST_ACCEPTED_CHECKPOINT) return;
              updateGame((state) => acceptUnit3Floor1Quest(state));
              requestSave("questAccepted", true);
            }}
            onComplete={finishStory}
          />
        </div>
      )}
      {shopOpen && <ShopPopup eyebrow="SUPPLY" title="보급물품" inventory={game.inventoryState} gold={game.playerState.gold} message={shopMessage} onBuy={buyItem} onClose={() => setShopOpen(false)} />}
      {inventoryOpen && <InventoryPopup
        inventory={game.inventoryState}
        gold={game.playerState.gold}
        onClose={() => setInventoryOpen(false)}
        onEquipmentChange={(slot, itemId) => {
          updateGame((state) => {
            const nextInventory = { ...state.inventoryState, equippedItemIds: { ...state.inventoryState.equippedItemIds, [slot]: itemId } };
            return { ...state, inventoryState: nextInventory, playerState: recalculatePlayerMaxHp(state.playerState, state.inventoryState, nextInventory) };
          });
          requestSave("equipmentChanged");
        }}
      />}
      {achievementOpen && (
        <div className="pixel-popup-backdrop achievement-backdrop" role="presentation">
          <section className="achievement-popup" role="dialog" aria-modal="true" aria-labelledby="chapter3-achievement-title">
            <header className="achievement-popup-header">
              <div><p className="eyebrow">ACHIEVEMENT</p><h2 id="chapter3-achievement-title">업적</h2></div>
              <button type="button" className="achievement-close-button" onClick={() => setAchievementOpen(false)} aria-label="업적 닫기">×</button>
            </header>
            <div className="achievement-list">
              {(() => {
                const received = Boolean(game.achievementReceived[UNIT3_FLOOR1_ACHIEVEMENT.id]);
                return (
                  <article className={`achievement-card ${received ? "is-received" : "is-progress"}`}>
                    <div className="achievement-floor-medal" aria-hidden="true">★</div>
                    <div className="achievement-card-copy">
                      <small>던전 1층 · {UNIT3_FLOOR1_TITLE}</small>
                      <strong>{UNIT3_FLOOR1_ACHIEVEMENT.title}</strong>
                      <span>{UNIT3_FLOOR1_ACHIEVEMENT.description}</span>
                    </div>
                    <div className="achievement-card-action"><span className="achievement-state">{received ? "달성" : "미달성"}</span></div>
                  </article>
                );
              })()}
            </div>
            <footer><button type="button" onClick={() => setAchievementOpen(false)}>닫기</button></footer>
          </section>
        </div>
      )}
      {rewardOpen && (
        <div className="pixel-popup-backdrop">
          <section className="pixel-rpg-popup quest-reward-popup chapter3-reward-popup" role="dialog" aria-modal="true" aria-labelledby="chapter3-reward-title">
            <header><p className="eyebrow">QUEST COMPLETE</p><h2 id="chapter3-reward-title">{UNIT3_FLOOR1_QUEST_TITLE} 완료</h2></header>
            <div className="quest-reward-grid chapter3-reward-grid">
              <article><p className="eyebrow">골드</p><span className="reward-icon">G</span><strong>{UNIT3_FLOOR1_REWARD.gold} Gold</strong></article>
              <article><p className="eyebrow">포션</p><span className="reward-icon"><ItemIcon item={smallPotion} /></span><strong>{smallPotion.name} {UNIT3_FLOOR1_REWARD.smallPotions}개</strong></article>
              <article className="is-unlocked"><p className="eyebrow">무기 스킨</p><span className="reward-icon"><ItemIcon item={hwando} /></span><strong>{hwando.name}</strong><small>능력치 변화 없음</small></article>
              <article className="is-unlocked"><p className="eyebrow">업적</p><span className="reward-icon">★</span><strong>{UNIT3_FLOOR1_ACHIEVEMENT.title}</strong><small>{UNIT3_FLOOR1_ACHIEVEMENT.description}</small></article>
            </div>
            <div className="quest-reward-actions">
              {rewardClaimed
                ? <button type="button" onClick={() => setRewardOpen(false)}>확인</button>
                : <button type="button" onClick={claimReward}>보상 받기</button>}
            </div>
          </section>
        </div>
      )}
      <button type="button" className="chapter3-title-return" onClick={() => onNavigate("title")}>처음 화면</button>
      <div className="chapter3-camp-arrival-fade" aria-hidden="true" />
    </main>
  );
}
