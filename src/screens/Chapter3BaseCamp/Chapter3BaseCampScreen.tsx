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
import {
  UNIT3_FLOOR2_ACHIEVEMENT, UNIT3_FLOOR2_ID, UNIT3_FLOOR2_QUEST_ID, UNIT3_FLOOR2_QUEST_TITLE, UNIT3_FLOOR2_REWARD, UNIT3_FLOOR2_TITLE,
  acceptUnit3Floor2Quest, completeUnit3Floor2Quest, getUnit3Floor2QuestPhase, getUnit3TargetFloorId,
} from "../../game/chapter3/unit3Floor2";
import {
  UNIT3_FLOOR2_ACTIVE_REMINDER_STORY, UNIT3_FLOOR2_AFTER_COMPLETE_STORY, UNIT3_FLOOR2_KAIDEN_ACTIVE_STORY, UNIT3_FLOOR2_KAIDEN_TALK_STORY,
  UNIT3_FLOOR2_QUEST_ACCEPTED_CHECKPOINT, UNIT3_FLOOR2_QUEST_COMPLETE_STORY, UNIT3_FLOOR2_QUEST_OFFER_STORY,
} from "../../data/chapter3/floor2Stories";
import { UNIT3_FLOOR1_ID } from "../../game/chapter3/unit3Floor1";
import { EMERGENCY_SUPPLY_STORY } from "../../data/chapter3/emergencySupplyStory";
import { applyEmergencySupply, evaluateEmergencySupply } from "../../game/chapter3/emergencySupply";
import { playRandomizedOneShot } from "../../game/audioOneShot";

type Unit3CampFloorId = typeof UNIT3_FLOOR1_ID | typeof UNIT3_FLOOR2_ID;
const HEAL_SFX_URL = `${import.meta.env.BASE_URL}assets/audio/heal-sfx.mp3`;

type Props = {
  game: GameSaveState;
  updateGame: (update: (current: GameSaveState) => GameSaveState) => void;
  requestSave: (reason: SaveReason, immediate?: boolean) => void;
  onNavigate: (screen: ScreenId) => void;
  /** Opens the dungeon on the given Unit 3 floor. */
  onEnterDungeon: (floorId: Unit3CampFloorId) => void;
};

type ActiveStory = { sequence: StorySequence; kind: "offer" | "return" | "complete" | "talk" | "supply"; floor?: Unit3CampFloorId };

/**
 * Unit 3 base camp (Phase 2). Deneb, Kaiden, the supply crates and the dungeon entrance are clickable
 * (white pixel outline + pointer cursor on hover, hitboxes fitted to the visible pixels). The HP bar is not
 * shown here (dungeon only). The shop reuses the Unit 2 ShopPopup, inventory and gold logic unchanged.
 */
export function Chapter3BaseCampScreen({ game, updateGame, requestSave, onNavigate, onEnterDungeon }: Props) {
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
  const [rewardFloor, setRewardFloor] = useState<Unit3CampFloorId>(UNIT3_FLOOR1_ID);
  const [floorSelectOpen, setFloorSelectOpen] = useState(false);
  const [supplyGrant, setSupplyGrant] = useState<number | null>(null);
  const floor1Phase = getUnit3Floor1QuestPhase(game);
  const floor2Phase = getUnit3Floor2QuestPhase(game);
  /** Deneb / Kaiden / tracker follow Floor 1 until its quest is completed, then Floor 2 (Phase 3). */
  const campFloor: Unit3CampFloorId = floor1Phase === "completed" && floor2Phase !== "locked" ? UNIT3_FLOOR2_ID : UNIT3_FLOOR1_ID;
  const questPhase = campFloor === UNIT3_FLOOR2_ID ? floor2Phase as Exclude<typeof floor2Phase, "locked"> : floor1Phase;
  const flags = game.firstObjectiveEventSeen;
  const busy = story !== null || shopOpen || inventoryOpen || achievementOpen || rewardOpen || floorSelectOpen || supplyGrant !== null;

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
    if (target === "supply") {
      // Emergency support first (only when the student truly cannot afford the current floor), then the shop.
      if (evaluateEmergencySupply(game).grant > 0) { setStory({ sequence: EMERGENCY_SUPPLY_STORY, kind: "supply" }); return; }
      setShopMessage(""); setShopOpen(true); return;
    }
    if (target === "dungeonEntrance") {
      const pending = getUnit3TargetFloorId(game);
      if (pending) { onEnterDungeon(pending); return; }
      if (questPhase === "notAccepted") { setNotice("데네브와 먼저 이야기해 보세요."); return; }
      const unlocked = enterableFloors();
      if (unlocked.length > 1) { setFloorSelectOpen(true); return; }
      onEnterDungeon(unlocked[0] ?? UNIT3_FLOOR1_ID);
      return;
    }
    const floor2 = campFloor === UNIT3_FLOOR2_ID;
    const offer = floor2 ? UNIT3_FLOOR2_QUEST_OFFER_STORY : UNIT3_FLOOR1_QUEST_OFFER_STORY;
    if (target === "deneb") {
      if (questPhase === "notAccepted") setStory({ sequence: offer, kind: "offer", floor: campFloor });
      else if (questPhase === "readyToComplete") setStory({ sequence: floor2 ? UNIT3_FLOOR2_QUEST_COMPLETE_STORY : UNIT3_FLOOR1_QUEST_COMPLETE_STORY, kind: "complete", floor: campFloor });
      else if (questPhase === "active") setStory({ sequence: floor2 ? UNIT3_FLOOR2_ACTIVE_REMINDER_STORY : UNIT3_FLOOR1_ACTIVE_REMINDER_STORY, kind: "talk" });
      else setStory({ sequence: floor2 ? UNIT3_FLOOR2_AFTER_COMPLETE_STORY : UNIT3_FLOOR1_AFTER_COMPLETE_STORY, kind: "talk" });
      return;
    }
    if (questPhase === "notAccepted") setStory({ sequence: offer, kind: "offer", floor: campFloor });
    else if (questPhase === "completed") setStory({ sequence: floor2 ? UNIT3_FLOOR2_KAIDEN_TALK_STORY : UNIT3_FLOOR1_KAIDEN_TALK_STORY, kind: "talk" });
    else setStory({ sequence: floor2 ? UNIT3_FLOOR2_KAIDEN_ACTIVE_STORY : UNIT3_FLOOR1_KAIDEN_ACTIVE_STORY, kind: "talk" });
  };

  /** Floors whose quest was accepted (unlocked) — offered by the entrance when nothing is pending. */
  const enterableFloors = (): Unit3CampFloorId[] =>
    ([UNIT3_FLOOR1_ID, UNIT3_FLOOR2_ID] as Unit3CampFloorId[]).filter((floorId) => game.floorUnlockState.unlockedFloorIds.includes(floorId));

  const finishStory = () => {
    const current = story;
    setStory(null);
    if (!current) return;
    if (current.kind === "return") {
      updateGame((state) => markUnit3Flag(state, UNIT3_FLOOR1_FLAGS.baseCampReturn));
      requestSave("storyCompleted", true);
    } else if (current.kind === "complete") {
      setRewardFloor(current.floor ?? UNIT3_FLOOR1_ID);
      setRewardOpen(true);
    } else if (current.kind === "supply") {
      // Potions are handed out only after the last line, re-evaluated against the latest state (no duplicates).
      let granted = 0;
      updateGame((state) => { const result = applyEmergencySupply(state); granted = result.granted; return result.state; });
      requestSave("itemAcquired", true);
      if (granted > 0) playRandomizedOneShot(HEAL_SFX_URL);
      setSupplyGrant(granted);
    } else {
      requestSave("npcDialogueCompleted");
    }
  };

  const claimReward = () => {
    updateGame((state) => rewardFloor === UNIT3_FLOOR2_ID ? completeUnit3Floor2Quest(state) : completeUnit3Floor1Quest(state));
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
  const rewardSpec = rewardFloor === UNIT3_FLOOR2_ID
    ? { questId: UNIT3_FLOOR2_QUEST_ID, title: UNIT3_FLOOR2_QUEST_TITLE, reward: UNIT3_FLOOR2_REWARD, achievement: UNIT3_FLOOR2_ACHIEVEMENT }
    : { questId: UNIT3_FLOOR1_QUEST_ID, title: UNIT3_FLOOR1_QUEST_TITLE, reward: UNIT3_FLOOR1_REWARD, achievement: UNIT3_FLOOR1_ACHIEVEMENT };
  const rewardClaimed = Boolean(game.rewardClaimed[rewardSpec.questId]);
  const rewardWeapon = getItemDefinition(rewardSpec.reward.weaponItemId)!;
  const smallPotion = getItemDefinition("potion-small")!;
  const campQuestTitle = campFloor === UNIT3_FLOOR2_ID ? UNIT3_FLOOR2_QUEST_TITLE : UNIT3_FLOOR1_QUEST_TITLE;
  const campFloorLabel = campFloor === UNIT3_FLOOR2_ID ? `던전 2층 · ${UNIT3_FLOOR2_TITLE}` : `던전 1층 · ${UNIT3_FLOOR1_TITLE}`;

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
        {questPhase === "active" && <><strong>{campQuestTitle}</strong><span>{campFloorLabel}</span><small>진행 중</small></>}
        {questPhase === "readyToComplete" && <><strong>{campQuestTitle}</strong><span>데네브에게 결과를 보고하세요.</span><small>완료 보고 가능</small></>}
        {questPhase === "completed" && <><strong>{campQuestTitle}</strong><span>완료</span></>}
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
              if (checkpointId === UNIT3_FLOOR1_QUEST_ACCEPTED_CHECKPOINT) updateGame((state) => acceptUnit3Floor1Quest(state));
              else if (checkpointId === UNIT3_FLOOR2_QUEST_ACCEPTED_CHECKPOINT) updateGame((state) => acceptUnit3Floor2Quest(state));
              else return;
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
              {[
                { floorLabel: `던전 1층 · ${UNIT3_FLOOR1_TITLE}`, achievement: UNIT3_FLOOR1_ACHIEVEMENT },
                { floorLabel: `던전 2층 · ${UNIT3_FLOOR2_TITLE}`, achievement: UNIT3_FLOOR2_ACHIEVEMENT },
              ].map(({ floorLabel, achievement }) => {
                const received = Boolean(game.achievementReceived[achievement.id]);
                return (
                  <article key={achievement.id} className={`achievement-card ${received ? "is-received" : "is-progress"}`}>
                    <div className="achievement-floor-medal" aria-hidden="true">★</div>
                    <div className="achievement-card-copy">
                      <small>{floorLabel}</small>
                      <strong>{achievement.title}</strong>
                      <span>{achievement.description}</span>
                    </div>
                    <div className="achievement-card-action"><span className="achievement-state">{received ? "달성" : "미달성"}</span></div>
                  </article>
                );
              })}
            </div>
            <footer><button type="button" onClick={() => setAchievementOpen(false)}>닫기</button></footer>
          </section>
        </div>
      )}
      {rewardOpen && (
        <div className="pixel-popup-backdrop">
          <section className="pixel-rpg-popup quest-reward-popup chapter3-reward-popup" role="dialog" aria-modal="true" aria-labelledby="chapter3-reward-title">
            <header><p className="eyebrow">QUEST COMPLETE</p><h2 id="chapter3-reward-title">{rewardSpec.title} 완료</h2></header>
            <div className="quest-reward-grid chapter3-reward-grid">
              <article><p className="eyebrow">골드</p><span className="reward-icon">G</span><strong>{rewardSpec.reward.gold} Gold</strong></article>
              <article><p className="eyebrow">포션</p><span className="reward-icon"><ItemIcon item={smallPotion} /></span><strong>{smallPotion.name} {rewardSpec.reward.smallPotions}개</strong></article>
              <article className="is-unlocked"><p className="eyebrow">무기 스킨</p><span className="reward-icon"><ItemIcon item={rewardWeapon} /></span><strong>{rewardWeapon.name}</strong><small>능력치 변화 없음</small></article>
              <article className="is-unlocked"><p className="eyebrow">업적</p><span className="reward-icon">★</span><strong>{rewardSpec.achievement.title}</strong><small>{rewardSpec.achievement.description}</small></article>
            </div>
            <div className="quest-reward-actions">
              {rewardClaimed
                ? <button type="button" onClick={() => setRewardOpen(false)}>확인</button>
                : <button type="button" onClick={claimReward}>보상 받기</button>}
            </div>
          </section>
        </div>
      )}
      {supplyGrant !== null && (
        <div className="pixel-popup-backdrop">
          <section className="pixel-rpg-popup quest-reward-popup chapter3-reward-popup chapter3-supply-grant-popup" role="dialog" aria-modal="true" aria-labelledby="chapter3-supply-title">
            <header><p className="eyebrow">SUPPLY</p><h2 id="chapter3-supply-title">보급 물품 획득</h2></header>
            <div className="quest-reward-grid chapter3-reward-grid">
              <article><p className="eyebrow">포션</p><span className="reward-icon"><ItemIcon item={smallPotion} /></span>
                <strong>{supplyGrant > 0 ? `${smallPotion.name} ${supplyGrant}개` : "받을 수 있는 보급품이 없습니다."}</strong></article>
            </div>
            <div className="quest-reward-actions">
              <button type="button" onClick={() => { setSupplyGrant(null); setShopMessage(""); setShopOpen(true); }}>확인</button>
            </div>
          </section>
        </div>
      )}
      {floorSelectOpen && (
        <div className="pixel-popup-backdrop" role="presentation" onMouseDown={() => setFloorSelectOpen(false)}>
          <section className="pixel-rpg-popup chapter3-floor-select-popup" role="dialog" aria-modal="true" aria-labelledby="chapter3-floor-select-title" onMouseDown={(event) => event.stopPropagation()}>
            <header><p className="eyebrow">DUNGEON</p><h2 id="chapter3-floor-select-title">어느 층으로 갈까요?</h2>
              <button className="pixel-popup-close-button" type="button" onClick={() => setFloorSelectOpen(false)} aria-label="층 선택 닫기">×</button></header>
            <div className="chapter3-floor-select-list">
              {enterableFloors().map((floorId) => (
                <button key={floorId} type="button" className={`chapter3-floor-select-button floor-${floorId}`} onClick={() => { setFloorSelectOpen(false); onEnterDungeon(floorId); }}>
                  <strong>{floorId === UNIT3_FLOOR2_ID ? "던전 2층" : "던전 1층"}</strong>
                  <span>{floorId === UNIT3_FLOOR2_ID ? UNIT3_FLOOR2_TITLE : UNIT3_FLOOR1_TITLE}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      <button type="button" className="chapter3-title-return" onClick={() => onNavigate("title")}>처음 화면</button>
      <div className="chapter3-camp-arrival-fade" aria-hidden="true" />
    </main>
  );
}
