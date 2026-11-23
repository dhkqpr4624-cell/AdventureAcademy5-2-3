import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { ScreenId } from "../../app/routes";
import { getBaseCampMap } from "../../data/baseCampMaps";
import type {
  StoryRenderState,
  StorySequence,
  StoryVisualAsset,
} from "../../types/story";
import { StoryStepRunner } from "./StoryStepRunner";
import {
  BaseCampStoryAdapter,
  type BaseCampStoryController,
} from "./BaseCampStoryAdapter";
import { PlayerStatusBar } from "../../components/PlayerStatusBar";
import type { PlayerState } from "../player/playerState";
import {
  DEFAULT_STORY_PRESENTATION_MODE,
  shouldShowStoryPlayerStatus,
  type StoryPresentationMode,
} from "./storyPresentationTypes";
import { StoryChoiceList } from "../../components/StoryChoiceList";
import type { StoryChoiceOption } from "../../types/story";
import { StoryNpcRenderer } from "./StoryNpcRenderer";
import { STORY_NPC_ASSET_URLS } from "./storyNpcRegistry";

type StoryPlayerProps = {
  sequence: StorySequence;
  onNavigate: (screen: ScreenId) => void;
  onComplete?: () => void;
  onStoryStarted?: (storyId: string) => void;
  onCheckpointReached?: (storyId: string, checkpointId: string) => void;
  onStoryCompleted?: (storyId: string) => void;
  playerStatus?: PlayerState;
  presentationMode?: StoryPresentationMode;
  onChoiceAction?: (actionId: string) => void;
  playerName?: string;
  /** World NPC ids left off the BaseCamp map of a showBaseCamp step (story-scoped; default: none). */
  hiddenBaseCampNpcIds?: readonly string[];
  /** Chapter-specific stage renderers keyed by setStagePhase.stageId (rendered under the dialogue UI). */
  stageRenderers?: Readonly<Record<string, (phase: string, revision: number) => ReactNode>>;
};

const INITIAL_RENDER_STATE: StoryRenderState = {
  backgroundId: null,
  backgroundTransition: "none",
  backgroundRevision: 0,
  portraits: {},
  dialogue: null,
  baseCampMapId: null,
  fade: { visible: false, color: "#000000", durationMs: 0 },
  camera: {
    x: 0, y: 0, zoom: 1, durationMs: 0,
    shakeDurationMs: 0, shakeAmplitude: 0, shakeRevision: 0,
  },
  storyNpcs: {},
  illust: { imageUrl: null, previousImageUrl: null, visible: false, fadeMs: 250, crossFadeDelayMs: 0, revision: 0 },
  stage: { id: null, phase: "", revision: 0 },
};

function createInitialRenderState(sequence: StorySequence): StoryRenderState {
  if (sequence.id !== "intro-scene-1") {
    return INITIAL_RENDER_STATE;
  }

  return {
    ...INITIAL_RENDER_STATE,
    camera: {
      ...INITIAL_RENDER_STATE.camera,
      x: 115,
      y: 100,
      zoom: 0.78,
    },
  };
}

function collectImageUrls(sequence: StorySequence) {
  const assets: StoryVisualAsset[] = [
    ...Object.values(sequence.backgrounds),
    ...Object.values(sequence.actors).flatMap((actor) =>
      Object.values(actor.portraits),
    ),
  ];

  return [
    ...new Set([
      ...assets.flatMap((asset) => [
        ...(asset.imageUrl ? [asset.imageUrl] : []),
        ...(asset.layers?.map((layer) => layer.imageUrl) ?? []),
      ]),
      ...sequence.scenes.flatMap((scene) =>
        scene.steps.flatMap((step) =>
          step.type === "illustOverlay" && step.imageUrl
            ? [step.imageUrl]
            : [],
        ),
      ),
      ...STORY_NPC_ASSET_URLS,
    ]),
  ];
}

function StoryAsset({
  asset,
  alt,
  failedUrls,
  onImageError,
}: {
  asset: StoryVisualAsset;
  alt: string;
  failedUrls: ReadonlySet<string>;
  onImageError: (url: string) => void;
}) {
  const canShowImage = asset.imageUrl && !failedUrls.has(asset.imageUrl);

  if (canShowImage) {
    return (
      <img
        src={asset.imageUrl}
        alt={alt}
        draggable={false}
        onError={() => onImageError(asset.imageUrl!)}
      />
    );
  }

  return (
    <div
      className="story-asset-placeholder"
      style={{ background: asset.placeholder.gradient }}
      role="img"
      aria-label={`${alt} 임시 이미지`}
    >
      <span>{asset.placeholder.label}</span>
      {asset.placeholder.subtitle && <small>{asset.placeholder.subtitle}</small>}
    </div>
  );
}

/** Structured player-name token markers. Only explicit placeholders are converted into these. */
export const PLAYER_NAME_TOKEN_START = "\uE000";
export const PLAYER_NAME_TOKEN_END = "\uE001";
const PLAYER_NAME_TOKEN_PATTERN = /\uE000([^\uE001]*)\uE001/g;

export function stripPlayerNameTokens(text: string): string {
  return text.replace(PLAYER_NAME_TOKEN_PATTERN, "$1");
}

/** Replaces explicit player-name placeholders with structured, highlightable tokens. */
export function resolvePlayerNamePlaceholders(text: string, playerName: string): string {
  const normalizedName = playerName.trim() || "플레이어";
  const lastCharacter = Array.from(normalizedName).at(-1) ?? "어";
  const token = `${PLAYER_NAME_TOKEN_START}${normalizedName}${PLAYER_NAME_TOKEN_END}`;
  return text
    .replaceAll("{{playerNameLastCharacter}}", lastCharacter)
    .replaceAll("{{playerName}}", token)
    .replaceAll("(플레이어 이름)", token)
    .replaceAll("(플레이어이름)", token);
}

function DialogueText({ text }: { text: string }) {
  const renderPlayerName = (part: string, keyPrefix: string): ReactNode[] => {
    const nodes: ReactNode[] = [];
    let cursor = 0;
    let tokenIndex = 0;
    for (const match of part.matchAll(PLAYER_NAME_TOKEN_PATTERN)) {
      const start = match.index ?? 0;
      if (start > cursor) nodes.push(part.slice(cursor, start));
      nodes.push(
        <strong className="story-player-name" key={`${keyPrefix}-player-name-${tokenIndex}`}>
          {match[1]}
        </strong>,
      );
      tokenIndex += 1;
      cursor = start + match[0].length;
    }
    if (cursor < part.length) nodes.push(part.slice(cursor));
    return nodes;
  };

  const inlineStylePattern = /<(red|blue)><b>(.*?)<\/b><\/(?:red|blue)>/g;
  const result: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = inlineStylePattern.exec(text)) !== null) {
    result.push(...renderPlayerName(text.slice(cursor, match.index), `text-${index}`));
    result.push(<strong className={match[1] === "blue" ? "story-inline-info" : "story-inline-danger"} key={`emphasis-${index}`}>{stripPlayerNameTokens(match[2])}</strong>);
    cursor = match.index + match[0].length;
    index += 1;
  }
  result.push(...renderPlayerName(text.slice(cursor), `text-${index}`));
  return result;
}

export function StoryPlayer({
  sequence,
  onNavigate,
  onComplete,
  onStoryStarted,
  onStoryCompleted,
  onCheckpointReached,
  playerStatus,
  presentationMode = DEFAULT_STORY_PRESENTATION_MODE,
  onChoiceAction,
  playerName = "",
  hiddenBaseCampNpcIds,
  stageRenderers,
}: StoryPlayerProps) {
  const steps = useMemo(
    () => sequence.scenes.flatMap((scene) => scene.steps),
    [sequence],
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [renderState, setRenderState] =
    useState<StoryRenderState>(() => createInitialRenderState(sequence));
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [failedUrls, setFailedUrls] = useState<ReadonlySet<string>>(new Set());
  const clickLockRef = useRef(false);
  const hasNavigatedRef = useRef(false);
  const runnerRef = useRef(new StoryStepRunner());
  const activeStepAbortRef = useRef<AbortController | null>(null);
  const baseCampControllerRef = useRef<BaseCampStoryController>(null);
  const baseCampReadyRef = useRef(false);
  const startedRef = useRef(false);
  const choiceLockedRef = useRef(false);
  const skipLockedRef = useRef(false);
  const mountedAtRef = useRef(performance.now());
  const [completedChoiceActions, setCompletedChoiceActions] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      onStoryStarted?.(sequence.id);
    }
  }, [onStoryStarted, sequence.id]);

  const waitForBaseCampController = (signal: AbortSignal) =>
    new Promise<BaseCampStoryController | null>((resolve) => {
      const startedAt = performance.now();
      const check = () => {
        if (signal.aborted) {
          resolve(null);
          return;
        }
        if (baseCampReadyRef.current && baseCampControllerRef.current) {
          resolve(baseCampControllerRef.current);
          return;
        }
        if (performance.now() - startedAt >= 3000) {
          if (import.meta.env.DEV) {
            console.warn("[StoryPlayer] BaseCamp camera controller was not ready.");
          }
          resolve(null);
          return;
        }
        requestAnimationFrame(check);
      };
      check();
    });

  useEffect(() => {
    const imageUrls = collectImageUrls(sequence);
    const preloaders = imageUrls.map((url) => {
      const image = new Image();
      image.onload = () => undefined;
      image.onerror = () => {
        setFailedUrls((current) => {
          if (current.has(url)) {
            return current;
          }
          return new Set(current).add(url);
        });
      };
      image.src = url;
      return image;
    });

    return () => {
      preloaders.forEach((image) => {
        image.onload = null;
        image.onerror = null;
      });
    };
  }, [sequence]);

  useEffect(() => {
    const step = steps[stepIndex];

    if (!step) {
      if (!hasNavigatedRef.current) {
        hasNavigatedRef.current = true;
        onStoryCompleted?.(sequence.id);
        if (onComplete) {
          onComplete();
        } else {
          onNavigate(sequence.onCompleteScreen);
        }
      }
      return;
    }

    const abortController = new AbortController();
    activeStepAbortRef.current?.abort();
    activeStepAbortRef.current = abortController;
    const isClickStep =
      step.type === "dialogue" || step.type === "narration" || step.type === "choice";

    clickLockRef.current = true;
    choiceLockedRef.current = false;
    setIsTransitioning(true);
    let dwellTimer: number | null = null;

    void runnerRef.current
      .run(
        step,
        {
          updateState: setRenderState,
          changeScreen: (screen) => {
            if (!hasNavigatedRef.current) {
              hasNavigatedRef.current = true;
              onNavigate(screen);
            }
          },
          showBaseCamp: async (mapId, signal) => {
            if (!getBaseCampMap(mapId)) {
              if (import.meta.env.DEV) {
                console.warn(`[StoryPlayer] Unknown BaseCamp mapId: ${mapId}`);
              }
              return;
            }
            baseCampReadyRef.current = false;
            setRenderState((state) => ({
              ...state,
              baseCampMapId: mapId,
            }));
            await waitForBaseCampController(signal);
          },
          focusBaseCamp: async (focusPointId, durationMs, signal) => {
            const controller = await waitForBaseCampController(signal);
            await controller?.focus(focusPointId, durationMs, signal);
          },
          highlightBaseCampTarget: async (targetId) => {
            await baseCampControllerRef.current?.highlight(targetId);
          },
          clearBaseCampHighlight: async () => {
            await baseCampControllerRef.current?.clearHighlight();
          },
          restoreBaseCampCamera: async (durationMs, signal) => {
            const controller = await waitForBaseCampController(signal);
            await controller?.restore(durationMs, signal);
          },
          checkpoint: (checkpointId) => onCheckpointReached?.(sequence.id, checkpointId),
          resolveText: (text) => resolvePlayerNamePlaceholders(text, playerName),
          resolveExpression: (actorId, requestedExpression) => {
            const actor = sequence.actors[actorId];
            const fallbackExpression = actor?.defaultExpression ?? "default";
            const expression = requestedExpression ?? fallbackExpression;
            if (actor?.portraits[expression]) return expression;
            if (import.meta.env.DEV) {
              console.warn(`[StoryPlayer] Unknown portrait expression: ${actorId}/${expression}; using default.`);
            }
            return fallbackExpression;
          },
        },
        abortController.signal,
      )
      .then(() => {
        if (abortController.signal.aborted || hasNavigatedRef.current) {
          return;
        }

        if (isClickStep) {
          const unlock = () => {
            if (abortController.signal.aborted) return;
            clickLockRef.current = false;
            setIsTransitioning(false);
          };
          const dwellMs = sequence.minInputDwellMs ?? 0;
          if (dwellMs > 0) dwellTimer = window.setTimeout(unlock, dwellMs);
          else unlock();
          return;
        }

        setStepIndex((current) => current + 1);
      });

    return () => {
      abortController.abort();
      if (dwellTimer !== null) window.clearTimeout(dwellTimer);
      if (activeStepAbortRef.current === abortController) activeStepAbortRef.current = null;
    };
  }, [onCheckpointReached, onComplete, onNavigate, sequence.id, sequence.minInputDwellMs, sequence.onCompleteScreen, stepIndex, steps]);

  const currentStep = steps[stepIndex];
  const canAdvance =
    !isTransitioning &&
    (currentStep?.type === "dialogue" || currentStep?.type === "narration");

  const choose = (option: StoryChoiceOption) => {
    if (choiceLockedRef.current || isTransitioning) return;
    choiceLockedRef.current = true;
    if (option.actionId) {
      onChoiceAction?.(option.actionId);
      setCompletedChoiceActions((current) => new Set(current).add(option.actionId!));
    }
    if (option.closeStory) {
      setStepIndex(steps.length);
      return;
    }
    const target = option.nextStepId ? steps.findIndex((step) => step.id === option.nextStepId) : stepIndex + 1;
    setIsTransitioning(true);
    clickLockRef.current = true;
    setStepIndex(target >= 0 ? target : stepIndex + 1);
    // choiceLockedRef is released by the step effect of the next step, so a double click on a
    // choice can never also advance the dialogue that follows it.
  };

  const advance = () => {
    if (!canAdvance || clickLockRef.current) {
      return;
    }

    clickLockRef.current = true;
    setIsTransitioning(true);
    const conditional = currentStep?.type === "dialogue" ? currentStep.nextStepWhenActionsComplete : undefined;
    const completedAfterStep = conditional?.actionIds.every((id) => completedChoiceActions.has(id));
    const nextId = completedAfterStep ? conditional?.stepId : currentStep?.type === "dialogue" ? currentStep.nextStepId : undefined;
    const target = nextId ? steps.findIndex((step) => step.id === nextId) : -1;
    setStepIndex((current) => target >= 0 ? target : current + 1);
  };

  const skip = () => {
    const target = sequence.skipTarget;
    if (!target || skipLockedRef.current || hasNavigatedRef.current) return;
    if (sequence.skipDelayMs && performance.now() - mountedAtRef.current < sequence.skipDelayMs) return;
    skipLockedRef.current = true;
    activeStepAbortRef.current?.abort();
    runnerRef.current = new StoryStepRunner();
    if (target.stepId) {
      const index = steps.findIndex((step) => step.id === target.stepId);
      if (index >= 0) {
        setRenderState(createInitialRenderState(sequence));
        setStepIndex(index);
        return;
      }
    }
    hasNavigatedRef.current = true;
    if (target.complete) onStoryCompleted?.(sequence.id);
    if (target.screen) onNavigate(target.screen);
    else if (onComplete) onComplete();
    else onNavigate(sequence.onCompleteScreen);
  };

  const skipDialogue = () => {
    if (!sequence.dialogueSkip || skipLockedRef.current || hasNavigatedRef.current) return;
    skipLockedRef.current = true;
    activeStepAbortRef.current?.abort();
    runnerRef.current = new StoryStepRunner();
    hasNavigatedRef.current = true;
    onStoryCompleted?.(sequence.id);
    if (onComplete) onComplete();
    else onNavigate(sequence.onCompleteScreen);
  };

  const markImageFailed = (url: string) => {
    setFailedUrls((current) => {
      if (current.has(url)) {
        return current;
      }
      return new Set(current).add(url);
    });
  };

  const background = renderState.backgroundId
    ? sequence.backgrounds[renderState.backgroundId]
    : undefined;
  const activeActorId =
    renderState.dialogue?.kind === "dialogue"
      ? renderState.dialogue.activeActorId
      : undefined;
  const isNarration = renderState.dialogue?.kind === "narration";
  const isBaseCampOverlay = presentationMode === "baseCampOverlay";
  const showPlayerStatus = shouldShowStoryPlayerStatus(
    presentationMode,
    Boolean(playerStatus),
  );
  const dialogueActor =
    renderState.dialogue?.kind === "dialogue" && activeActorId
      ? sequence.actors[activeActorId]
      : undefined;
  const visiblePortraits =
    isNarration || currentStep?.type === "choice"
      ? []
      : Object.keys(renderState.portraits).length > 0
      ? Object.values(renderState.portraits)
      : dialogueActor?.portraits[dialogueActor.defaultExpression ?? "default"]
        ? [{
            actorId: dialogueActor.id,
            portraitId: dialogueActor.defaultExpression ?? "default",
            position: "left" as const,
            transition: "fade" as const,
            revision: 0,
          }]
        : [];
  const isAirshipScene = renderState.backgroundId === "airship";
  const isRuinsScene = renderState.backgroundId === "ruins";
  const backgroundLayers = background?.layers ?? [];
  const fixedAirshipSky = isAirshipScene
    ? backgroundLayers.find((layer) => layer.id === "sky")
    : undefined;
  const fixedRuinsBackground = isRuinsScene
    ? backgroundLayers.find((layer) => layer.id === "background")
    : undefined;
  const fixedBackgroundLayer = fixedAirshipSky ?? fixedRuinsBackground;
  const movingBackgroundLayers = fixedBackgroundLayer
    ? backgroundLayers.filter((layer) => layer.id !== fixedBackgroundLayer.id)
    : backgroundLayers;
  const dialogueFollowsWalk =
    currentStep?.type === "dialogue" && steps[stepIndex - 1]?.type === "npcWalk";
  const ruinsWorldDescendIndex = steps.findIndex(
    (step) => step.id === "scene2-world-descend",
  );
  const isRuinsWorldDescending =
    isRuinsScene &&
    ruinsWorldDescendIndex >= 0 &&
    stepIndex >= ruinsWorldDescendIndex;
  const isRuinsLeftFocus =
    isRuinsScene &&
    currentStep?.id.startsWith("scene2-camera-left") === true;
  const isRuinsRightFocus =
    isRuinsScene &&
    currentStep?.id.startsWith("scene2-camera-right") === true;
  const ruinsCameraFocusClass = isRuinsLeftFocus
    ? "is-ruins-focus-left"
    : isRuinsRightFocus
      ? "is-ruins-focus-right"
      : "";

  return (
    <main
      className={[
        "story-player",
        `story-player-${presentationMode}`,
        isAirshipScene ? "story-player-airship" : "",
        isRuinsScene ? "story-player-ruins" : "",
        sequence.className ?? "",
      ].filter(Boolean).join(" ")}
      aria-label={sequence.title}
      data-presentation-mode={presentationMode}
    >
      {sequence.skipTarget && <button type="button" className="story-skip-button" disabled={skipLockedRef.current} onClick={skip}>건너뛰기</button>}
      {renderState.stage.id && stageRenderers?.[renderState.stage.id]?.(renderState.stage.phase, renderState.stage.revision)}
      {sequence.persistentIllustBackdrop && <div className="story-illust-backdrop" aria-hidden="true" />}
      {fixedAirshipSky && (
        <div className="story-fixed-sky" aria-hidden="true">
          <div className="story-sky-scroll-track">
            {[0, 1].map((tileIndex) => (
              <img
                key={tileIndex}
                className="story-sky-scroll-tile"
                src={fixedAirshipSky.imageUrl}
                alt=""
                draggable={false}
                onError={() => markImageFailed(fixedAirshipSky.imageUrl)}
              />
            ))}
          </div>
        </div>
      )}
      <div
        key={renderState.camera.shakeRevision}
        className={`story-camera ${renderState.camera.shakeDurationMs > 0 ? "is-shaking" : ""} ${ruinsCameraFocusClass}`}
        style={{
          transform: `translate(${renderState.camera.x}%, ${renderState.camera.y}%) scale(${renderState.camera.zoom})`,
          transitionDuration: `${renderState.camera.durationMs}ms`,
          "--story-shake-amplitude": `${renderState.camera.shakeAmplitude}px`,
          "--story-shake-duration": `${renderState.camera.shakeDurationMs}ms`,
        } as CSSProperties}
      >
      {fixedRuinsBackground && (
        <div className="story-ruins-background" aria-hidden="true">
          <img
            className="story-background-layer"
            src={fixedRuinsBackground.imageUrl}
            alt=""
            draggable={false}
            onError={() => markImageFailed(fixedRuinsBackground.imageUrl)}
          />
        </div>
      )}
      <div className={`story-moving-world ${isRuinsWorldDescending ? "is-descending" : ""}`}>
        {!isBaseCampOverlay && (
          <div
            key={renderState.backgroundRevision}
            className={`story-background story-transition-${renderState.backgroundTransition}`}
          >
            {movingBackgroundLayers.map((layer) => (
              <img
                key={layer.id}
                className="story-background-layer"
                src={layer.imageUrl}
                alt=""
                draggable={false}
                style={{ zIndex: layer.order }}
                onError={() => markImageFailed(layer.imageUrl)}
              />
            ))}
            {background && !background.layers?.length && (
              <StoryAsset
                asset={background}
                alt={background.placeholder.label}
                failedUrls={failedUrls}
                onImageError={markImageFailed}
              />
            )}
          </div>
        )}

        <StoryNpcRenderer npcs={renderState.storyNpcs} />
      </div>

      {renderState.baseCampMapId && (
        <BaseCampStoryAdapter
          ref={baseCampControllerRef}
          mapId={renderState.baseCampMapId}
          hiddenNpcIds={hiddenBaseCampNpcIds}
          onReady={() => {
            baseCampReadyRef.current = true;
          }}
        />
      )}

      <div
        className="story-background-shade"
        aria-hidden="true"
      />
      </div>

      {renderState.illust.imageUrl && (
        <div
          className={`story-illust-overlay has-image ${sequence.persistentIllustBackdrop ? "has-persistent-backdrop" : ""} ${renderState.illust.visible ? "is-visible" : ""} ${renderState.illust.dimmed ? "is-dimmed" : ""}`}
          style={{
            "--story-illust-fade": `${renderState.illust.fadeMs}ms`,
          } as CSSProperties}
        >
          {renderState.illust.previousImageUrl && (
            <img
              className="is-previous"
              src={renderState.illust.previousImageUrl}
              alt=""
              draggable={false}
              style={{ "--story-illust-crossfade-delay": `${renderState.illust.crossFadeDelayMs}ms` } as CSSProperties}
            />
          )}
          <img key={renderState.illust.imageUrl} className="is-current" src={renderState.illust.imageUrl} alt="" draggable={false} />
        </div>
      )}

      {renderState.dialogue && !(currentStep?.type === "choice" && currentStep.presentation === "popup") && (
        <section
          className={`story-dialogue-box ${
            renderState.dialogue.kind === "narration" ? "is-narration" : ""
          } ${dialogueFollowsWalk ? "is-after-walk" : ""}`}
          aria-live="polite"
          style={
            dialogueActor
              ? ({ "--story-speaker-accent": dialogueActor.accentColor } as CSSProperties)
              : undefined
          }
        >
          <div className="story-dialogue-layout">
            {renderState.dialogue.kind === "dialogue" && (
              <div className="story-dialogue-portrait-group">
                <div className="story-portrait-layer" aria-live="polite">
                  {visiblePortraits.map((portrait) => {
                    const actor = sequence.actors[portrait.actorId];
                    const asset = actor?.portraits[portrait.portraitId];
                    const isDimmed = !isNarration && activeActorId !== portrait.actorId;

                    if (!actor || !asset) {
                      return null;
                    }

                    return (
                      <div
                        key={portrait.actorId}
                        className={[
                          "story-portrait",
                          `story-portrait-${portrait.position}`,
                          `story-transition-${portrait.transition}`,
                          isDimmed ? "is-dimmed" : "is-active",
                        ].join(" ")}
                      >
                        <StoryAsset
                          asset={asset}
                          alt={`${actor.name} ${portrait.portraitId}`}
                          failedUrls={failedUrls}
                          onImageError={markImageFailed}
                        />
                      </div>
                    );
                  })}
                </div>
                <p className={`story-speaker-name ${dialogueActor?.displayRole ? "has-role" : ""}`}>
                  {stripPlayerNameTokens(renderState.dialogue.speakerName)}
                  {dialogueActor?.displayRole && <small className="story-speaker-role">{dialogueActor.displayRole}</small>}
                </p>
              </div>
            )}
            <div className="story-dialogue-content">
              <p
                className={`story-dialogue-text ${
                  renderState.dialogue.kind === "dialogue" && renderState.dialogue.emphasis
                    ? `is-${renderState.dialogue.emphasis}-emphasis`
                    : ""
                }`}
              >
                <DialogueText text={renderState.dialogue.text} />
              </p>
            </div>
          </div>
          {currentStep?.type !== "choice" && <button
            type="button"
            className="story-next-button"
            disabled={!canAdvance}
            onClick={advance}
          >
            다음
          </button>}
          {showPlayerStatus && playerStatus && (
            <footer className="story-player-status">
              <PlayerStatusBar {...playerStatus} />
            </footer>
          )}
        </section>
      )}

      {renderState.dialogue && sequence.dialogueSkip && !sequence.skipTarget && <button
        type="button"
        className="story-dialogue-skip-button"
        disabled={skipLockedRef.current}
        onClick={skipDialogue}
      >건너뛰기</button>}

      {currentStep?.type === "choice" && currentStep.presentation === "popup" && (
        <div className="story-choice-popup-backdrop">
          <section className="story-choice-popup" role="dialog" aria-modal="true" aria-label={currentStep.prompt ?? "선택"}>
            {currentStep.prompt && <p>{currentStep.prompt}</p>}
            <div className="story-choice-popup-actions">
              {currentStep.options.map((option) => (
                <button key={option.id} type="button" disabled={isTransitioning} onClick={() => choose(option)}>{option.label}</button>
              ))}
            </div>
          </section>
        </div>
      )}

      {renderState.dialogue && currentStep?.type === "choice" && currentStep.presentation !== "popup" && (
        <StoryChoiceList
          options={currentStep.options.filter((option) => !(option.hideWhenActionCompleted && option.actionId && completedChoiceActions.has(option.actionId)))}
          disabled={isTransitioning}
          onChoose={choose}
        />
      )}

      <div
        className={`story-fade-layer ${renderState.fade.visible ? "is-visible" : ""}`}
        style={{
          backgroundColor: renderState.fade.color,
          transitionDuration: `${renderState.fade.durationMs}ms`,
        }}
        aria-hidden="true"
      />
    </main>
  );
}
