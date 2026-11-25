import { useState, type ReactNode } from "react";
import type {
  BaseCampInteractionRegion,
  BaseCampMapDefinition,
  BaseCampMode,
  BaseCampNpcView,
} from "../../types/baseCamp";
import { LoopingLayer } from "../../game/chapter3/LoopingLayer";
import { BaseCampTram } from "../../game/baseCamp/BaseCampTram";
import { NPC_DEFINITIONS } from "../../game/npc/npcDefinitions";
import type { NpcDefinition } from "../../game/npc/npcTypes";
import { resolveNpcPresentation } from "../../game/npc/npcPresentationResolver";
import { NpcIdleSprite } from "../../components/NpcIdleSprite";
import { GATE_OUTLINE_STEPS, NPC_OUTLINE_STEPS, outlinePadding, useOutlineImage } from "../../components/outlineMask";
import { DungeonEntranceAnimation } from "../../game/baseCamp/DungeonEntranceAnimation";
import { BASE_CAMP_LAYER } from "../../game/baseCamp/baseCampLayers";
import { NpcNameTag } from "../../components/NpcNameTag";
import { NpcQuestMarker } from "../../components/NpcQuestMarker";
import { DungeonEntranceButton } from "../../components/DungeonEntranceButton";
import type { QuestState } from "../../game/quest/questTypes";
import { resolveNpcQuestMarker } from "../../game/quest/questMarkerResolver";
import jeonSickImage from "../../assets/npcs/jeon/jeon_sick.png";

type BaseCampWorldProps = {
  map: BaseCampMapDefinition;
  mode: BaseCampMode;
  selectedRegionId: string | null;
  onSelectRegion: (region: BaseCampInteractionRegion) => void;
  highlightTargetId?: string | null;
  selectedNpcId?: string | null;
  onSelectNpc?: (npc: NpcDefinition) => void;
  interactionsDisabled?: boolean;
  questState: QuestState;
  visibleNpcIds?: readonly string[];
  jeonSick?: boolean;
  /** Replace the Unit 2 NPC roster with scenery NPCs (no dialogue / quest wiring). */
  npcViews?: readonly BaseCampNpcView[];
  viewHighlightId?: string | null;
  worldOverlay?: ReactNode;
};

type LayerName = keyof BaseCampMapDefinition["layers"];

type LayerLoadState = {
  status: "loading" | "loaded" | "error";
  naturalWidth?: number;
  naturalHeight?: number;
};

const LAYER_ORDER: LayerName[] = [
  "sky",
  "background",
  "foreground",
  "dungeonEntrance",
  "dungeonEntranceButton",
  "ground",
];

export function BaseCampWorld({
  map,
  mode,
  selectedRegionId,
  onSelectRegion,
  highlightTargetId = null,
  selectedNpcId = null,
  onSelectNpc,
  interactionsDisabled = false,
  questState,
  visibleNpcIds,
  jeonSick = false,
  npcViews,
  viewHighlightId = null,
  worldOverlay,
}: BaseCampWorldProps) {
  const [highlightedNpcId, setHighlightedNpcId] = useState<string | null>(null);
  const [dungeonEntranceHighlighted, setDungeonEntranceHighlighted] =
    useState(false);
  // Phase 4 hotfix: cached hover outline for the Unit 3 entrance (static silhouette; animation frames share it).
  const entranceOutlineUrl = useOutlineImage(npcViews ? map.layers.dungeonEntrance : undefined, map.worldWidth, map.worldHeight, GATE_OUTLINE_STEPS);
  const entranceOutlinePad = outlinePadding(GATE_OUTLINE_STEPS);
  const layerStyle = {
    width: map.worldWidth,
    height: map.worldHeight,
  };
  const [layerLoadStates, setLayerLoadStates] = useState<
    Record<LayerName, LayerLoadState>
  >(() =>
    Object.fromEntries(
      LAYER_ORDER.map((layerName) => [layerName, { status: "loading" }]),
    ) as Record<LayerName, LayerLoadState>,
  );

  const handleLayerLoad = (
    layerName: LayerName,
    image: HTMLImageElement,
  ) => {
    const loadState: LayerLoadState = {
      status: "loaded",
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    };
    setLayerLoadStates((current) => ({
      ...current,
      [layerName]: loadState,
    }));

    if (import.meta.env.DEV) {
      console.info(
        `[BaseCamp] ${layerName} loaded: ${image.currentSrc} (${image.naturalWidth}×${image.naturalHeight})`,
      );
    }
  };

  const handleLayerError = (layerName: LayerName, image: HTMLImageElement) => {
    setLayerLoadStates((current) => ({
      ...current,
      [layerName]: { status: "error" },
    }));

    if (import.meta.env.DEV) {
      console.error(
        `[BaseCamp] ${layerName} failed to load: ${image.currentSrc || image.src}`,
      );
    }
  };

  const renderLayerImage = (layerName: LayerName) => map.layers[layerName] && (
    <img
      src={map.layers[layerName]}
      alt=""
      draggable={false}
      onLoad={(event) => handleLayerLoad(layerName, event.currentTarget)}
      onError={(event) => handleLayerError(layerName, event.currentTarget)}
    />
  );
  const highlightedRegion = highlightTargetId
    ? map.interactionRegions.find((region) => region.id === highlightTargetId)
    : undefined;

  return (
    <div
      className="base-camp-world"
      style={layerStyle}
      data-testid="BaseCampWorld"
    >
      <div
        className="base-camp-layer sky-layer"
        style={{ zIndex: BASE_CAMP_LAYER.sky }}
        aria-hidden="true"
      >
        {renderLayerImage("sky")}
      </div>
      {map.cloudLoop && (
        <LoopingLayer
          src={map.cloudLoop.src}
          width={map.worldWidth}
          height={map.worldHeight}
          speed={map.cloudLoop.speed}
          z={BASE_CAMP_LAYER.cloud}
          className="base-camp-layer cloud-loop-layer"
        />
      )}
      <div
        className="base-camp-layer background-layer"
        style={{ zIndex: BASE_CAMP_LAYER.background }}
        aria-hidden="true"
      >
        {renderLayerImage("background")}
      </div>
      <div
        className="base-camp-layer foreground-layer"
        style={{ zIndex: BASE_CAMP_LAYER.foreground }}
        aria-hidden="true"
      >
        {renderLayerImage("foreground")}
      </div>
      <div
        className={`base-camp-layer dungeon-entrance-layer ${viewHighlightId === "dungeonEntrance" ? "is-hover-outlined" : ""} ${entranceOutlineUrl ? "has-outline-image" : ""}`}
        style={{ zIndex: BASE_CAMP_LAYER.structures }}
        aria-hidden="true"
      >
        {entranceOutlineUrl && (
          <span
            className="dungeon-entrance-outline"
            style={{ left: -entranceOutlinePad, top: -entranceOutlinePad, width: map.worldWidth + entranceOutlinePad * 2, height: map.worldHeight + entranceOutlinePad * 2, backgroundImage: `url("${entranceOutlineUrl}")` }}
          />
        )}
        {renderLayerImage("dungeonEntrance")}
        {map.dungeonEntranceAnimation && <DungeonEntranceAnimation animation={map.dungeonEntranceAnimation} worldWidth={map.worldWidth} worldHeight={map.worldHeight} />}
      </div>
      {map.layers.dungeonEntranceButton && <div
        className={`base-camp-layer dungeon-entrance-button-layer ${
          dungeonEntranceHighlighted ||
          selectedRegionId === "dungeonEntrance" ||
          highlightTargetId === "dungeonEntrance"
            ? "is-highlighted"
            : ""
        }`}
        style={{ zIndex: BASE_CAMP_LAYER.dungeonEntranceButton }}
        aria-hidden="true"
      >
        {renderLayerImage("dungeonEntranceButton")}
      </div>}
      {map.tram && <BaseCampTram tram={map.tram} worldWidth={map.worldWidth} zIndex={BASE_CAMP_LAYER.tram} />}
      <div
        className="base-camp-layer ground-layer"
        style={{ zIndex: BASE_CAMP_LAYER.ground }}
        aria-hidden="true"
      >
        {renderLayerImage("ground")}
      </div>
      <div
        className="base-camp-layer npc-layer"
        style={{ zIndex: BASE_CAMP_LAYER.npcSprite }}
      >
        {npcViews?.map((npc) => (
          <div key={npc.id} className="base-camp-npc-view" data-npc={npc.id}>
            <NpcIdleSprite npc={npc} selected={false} interactionHighlighted={viewHighlightId === npc.id} mirrored={npc.mirrored} outlineSteps={NPC_OUTLINE_STEPS} />
            <span className="base-camp-npc-view-tag" style={{ left: npc.placement.x, top: npc.placement.y, width: npc.placement.width, height: npc.placement.height }}>
              <NpcNameTag displayName={npc.displayName} displayRole={npc.displayRole} variant={npc.nameTagVariant} />
            </span>
          </div>
        ))}
        {!npcViews && NPC_DEFINITIONS.filter((npc) => !visibleNpcIds || visibleNpcIds.includes(npc.id)).map((npc) => {
          const displayedNpc = npc.id === "jeon" && jeonSick
            ? {
                ...npc,
                idle: {
                  ...npc.idle,
                  standingImage: jeonSickImage,
                  blinkSpriteSheet: jeonSickImage,
                  blinkFrameCount: 1,
                  blinkFrameWidth: 600,
                  blinkFrameHeight: 750,
                },
                placement: {
                  ...npc.placement,
                  x: npc.placement.x + (npc.placement.width - npc.placement.height * (600 / 750)) / 2,
                  width: npc.placement.height * (600 / 750),
                },
              }
            : npc;
          return <NpcIdleSprite
            key={displayedNpc.id}
            npc={displayedNpc}
            selected={selectedNpcId === npc.id}
            interactionHighlighted={
              highlightedNpcId === npc.id || selectedNpcId === npc.id
            }
          />;
        })}
      </div>
      <div
        className={`base-camp-layer interaction-layer ${
          mode === "story" || interactionsDisabled ? "is-disabled" : ""
        }`}
        style={{ zIndex: BASE_CAMP_LAYER.interactionOverlay }}
      >
        {!npcViews && NPC_DEFINITIONS.filter((npc) => !visibleNpcIds || visibleNpcIds.includes(npc.id)).map((npc) => {
          const presentation = resolveNpcPresentation(npc.id);
          const questMarker = resolveNpcQuestMarker(npc, questState);
          return (
            <button
              key={presentation.id}
              type="button"
              className={`base-camp-npc-interaction ${
                selectedNpcId === npc.id ? "is-selected" : ""
              }`}
              style={{
                left: npc.placement.x,
                top: npc.placement.y,
                width: npc.placement.width,
                height: npc.placement.height,
              }}
              disabled={mode === "story" || interactionsDisabled}
              onClick={() => onSelectNpc?.(npc)}
              onPointerEnter={() => setHighlightedNpcId(npc.id)}
              onPointerLeave={() =>
                setHighlightedNpcId((current) =>
                  current === npc.id ? null : current
                )
              }
              onFocus={() => setHighlightedNpcId(npc.id)}
              onBlur={() =>
                setHighlightedNpcId((current) =>
                  current === npc.id ? null : current
                )
              }
              aria-label={`${presentation.displayName}, ${presentation.role}와 대화하기`}
            >
              <NpcNameTag
                displayName={presentation.displayName}
                displayRole={presentation.baseCampDisplayRole}
              />
              {questMarker !== "none" && (
                <NpcQuestMarker
                  displayName={presentation.displayName}
                  marker={questMarker}
                />
              )}
            </button>
          );
        })}
        {map.interactionRegions.map((region) =>
          region.id === "dungeonEntrance" ? (
            <DungeonEntranceButton
              key={region.id}
              region={region}
              disabled={mode === "story" || interactionsDisabled}
              selected={selectedRegionId === region.id}
              onClick={() => onSelectRegion(region)}
              onHighlightChange={setDungeonEntranceHighlighted}
            />
          ) : (
          <button
            key={region.id}
            type="button"
            className={`base-camp-interaction-region region-${region.id} ${
              selectedRegionId === region.id ? "is-selected" : ""
            }`}
            style={{
              left: region.x,
              top: region.y,
              width: region.width,
              height: region.height,
            }}
            disabled={mode === "story" || interactionsDisabled}
            onClick={() => onSelectRegion(region)}
            aria-label={`${region.label} 개발용 클릭 영역`}
          >
            <span
              className="base-camp-dev-marker"
              style={{
                left: (region.markerX ?? region.x) - region.x,
                top: (region.markerY ?? region.y) - region.y,
              }}
            >
              개발용
              <small>{region.id}</small>
            </span>
          </button>
          ),
        )}
      </div>
      {worldOverlay && <div className="base-camp-layer chapter3-world-overlay" style={{ zIndex: BASE_CAMP_LAYER.interactionOverlay + 1 }}>{worldOverlay}</div>}
      <div
        className="base-camp-layer highlight-layer"
        style={{ zIndex: BASE_CAMP_LAYER.highlight }}
        aria-hidden="true"
      >
        {highlightedRegion && (
          <span
            className="base-camp-target-highlight"
            style={{
              left: highlightedRegion.x,
              top: highlightedRegion.y,
              width: highlightedRegion.width,
              height: highlightedRegion.height,
            }}
          />
        )}
        {selectedRegionId && selectedRegionId !== "dungeonEntrance" && (
          <span className="base-camp-highlight-label">
            선택: {selectedRegionId}
          </span>
        )}
      </div>
      {import.meta.env.DEV && (
        <output
          className="base-camp-layer-debug"
          style={{ zIndex: BASE_CAMP_LAYER.debug }}
          aria-live="polite"
        >
          {LAYER_ORDER.map((layerName) => {
            const state = layerLoadStates[layerName];
            return (
              <span key={layerName}>
                {layerName}: {state.status}
                {state.naturalWidth && state.naturalHeight
                  ? ` ${state.naturalWidth}×${state.naturalHeight}`
                  : ""}
              </span>
            );
          })}
        </output>
      )}
    </div>
  );
}
