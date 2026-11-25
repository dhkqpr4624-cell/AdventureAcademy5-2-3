import type { ReactNode } from "react";
import type { DungeonMapDefinition, DungeonRoomProgress } from "../dungeon/dungeonTypes";
import type { StorySequence } from "../../types/story";
import {
  UNIT3_FLOOR1_FLAGS, UNIT3_FLOOR1_ID, UNIT3_FLOOR1_STORY_FLAGS, applyUnit3Floor1Progress, prepareUnit3Floor1Map, type Unit3Flags,
} from "./unit3Floor1";
import {
  UNIT3_FLOOR2_FLAGS, UNIT3_FLOOR2_ID, UNIT3_FLOOR2_STORY_FLAGS, applyUnit3Floor2Progress, prepareUnit3Floor2Map,
} from "./unit3Floor2";
import {
  UNIT3_FLOOR1_CART_AFTER_STORY, UNIT3_FLOOR1_CART_CRASH_CHECKPOINT, UNIT3_FLOOR1_CART_INTRO_STORY, UNIT3_FLOOR1_FINAL_STORY,
  UNIT3_FLOOR1_POST_EVENTS_STORY, UNIT3_FLOOR1_STAGE_ID, UNIT3_FLOOR1_START_STORY, UNIT3_FLOOR1_STORY_ROOM_STORIES,
} from "../../data/chapter3/floor1Stories";
import {
  UNIT3_FLOOR2_FINAL_STORY, UNIT3_FLOOR2_FOOTSTEPS_CHECKPOINT, UNIT3_FLOOR2_POST_EVENTS_STORY, UNIT3_FLOOR2_SCHOOL_AFTER_STORY,
  UNIT3_FLOOR2_SCHOOL_INTRO_STORY, UNIT3_FLOOR2_SHOUT_CHECKPOINT, UNIT3_FLOOR2_STAGE_ID, UNIT3_FLOOR2_START_STORY, UNIT3_FLOOR2_STORY_ROOM_STORIES,
} from "../../data/chapter3/floor2Stories";
import {
  UNIT3_FLOOR3_FLAGS, UNIT3_FLOOR3_ID, UNIT3_FLOOR3_INVESTIGATION_PLACES, UNIT3_FLOOR3_STORY_FLAGS, applyUnit3Floor3Progress, prepareUnit3Floor3Map,
} from "./unit3Floor3";
import {
  UNIT3_FLOOR3_EVENT_MAP_SEGMENTS, UNIT3_FLOOR3_MID_STORY, UNIT3_FLOOR3_POST_EVENTS_STORY, UNIT3_FLOOR3_STAGE_ID, UNIT3_FLOOR3_START_STORY,
  UNIT3_FLOOR3_STORY_ROOM_STORIES,
} from "../../data/chapter3/floor3Stories";
import { Unit3Floor3Stage, UNIT3_FLOOR3_PORTRAIT_URLS, UNIT3_FLOOR3_STAGE_IMAGE_URLS, preloadImages } from "./Unit3Floor3Stage";
import { Unit3Floor3EventMap, U3EM_IMAGE_URLS } from "./eventMap/Unit3Floor3EventMap";
import { Unit3Floor1Stage } from "./Unit3Floor1Stage";
import { Unit3Floor2Stage, preloadUnit3Floor2StageImages } from "./Unit3Floor2Stage";
import { playCartCrash, playDistantShout, playFootsteps } from "../audio/chapter3ProceduralSfx";
import type { GyeongseongProfile } from "../../three/dungeon/gyeongseong/gyeongseongLayout";

/**
 * Unit 3 story floors share one dungeon flow (Phase 2 Floor 1, reused for Floor 2 in Phase 3):
 * start event → mandatory main-route fight (room right after the start) with a story before and after →
 * three dead-end story rooms in any order → one post-event talk → combat-free final room → base camp.
 * Everything floor-specific (flags, stories, stage, SFX cues, layout rules, street profile) lives here.
 */
export type Unit3StoryFloor = {
  floorId: typeof UNIT3_FLOOR1_ID | typeof UNIT3_FLOOR2_ID | typeof UNIT3_FLOOR3_ID;
  flags: { startEvent: string; mainFight: string; postEventTalk: string; finalStory: string };
  storyFlags: readonly string[];
  prepareMap: (map: DungeonMapDefinition, seed: string) => DungeonMapDefinition;
  applyProgress: (map: DungeonMapDefinition, progress: Record<string, DungeonRoomProgress>, flags: Unit3Flags) => Record<string, DungeonRoomProgress>;
  stories: { start: StorySequence; fightIntro: StorySequence; fightAfter: StorySequence; rooms: readonly StorySequence[]; postEvents: StorySequence; final: StorySequence };
  stageId: string;
  renderStage: (phase: string) => ReactNode;
  onCheckpoint: (checkpointId: string) => void;
  /** Exploration message after the main-route fight story. */
  afterFightMessage: string;
  streetProfile: GyeongseongProfile;
  preload?: () => void;
  /**
   * Phase 4 (Floor 3): the main-route room right after the start is a dialogue-only story room — `fightIntro`
   * plays there and completes the room; there is no fight and `fightAfter` is never played.
   */
  mainEventFightless?: boolean;
  /** Phase 4 (Floor 3): the final room plays this scripted scene instead of the `final` StorySequence. */
  renderFinal?: (props: { playerName: string; playerStatus: unknown; onComplete: () => void }) => ReactNode;
  /** Phase 4 (Floor 3): "조사 현황" labels for the three story rooms (same order as storyFlags). */
  investigationPlaces?: readonly string[];
};

export const UNIT3_STORY_FLOORS: Record<string, Unit3StoryFloor> = {
  [UNIT3_FLOOR1_ID]: {
    floorId: UNIT3_FLOOR1_ID,
    flags: { startEvent: UNIT3_FLOOR1_FLAGS.startEvent, mainFight: UNIT3_FLOOR1_FLAGS.cartRescue, postEventTalk: UNIT3_FLOOR1_FLAGS.postEventTalk, finalStory: UNIT3_FLOOR1_FLAGS.finalStory },
    storyFlags: UNIT3_FLOOR1_STORY_FLAGS,
    prepareMap: prepareUnit3Floor1Map,
    applyProgress: applyUnit3Floor1Progress,
    stories: {
      start: UNIT3_FLOOR1_START_STORY, fightIntro: UNIT3_FLOOR1_CART_INTRO_STORY, fightAfter: UNIT3_FLOOR1_CART_AFTER_STORY,
      rooms: UNIT3_FLOOR1_STORY_ROOM_STORIES, postEvents: UNIT3_FLOOR1_POST_EVENTS_STORY, final: UNIT3_FLOOR1_FINAL_STORY,
    },
    stageId: UNIT3_FLOOR1_STAGE_ID,
    renderStage: (phase) => <Unit3Floor1Stage phase={phase} />,
    onCheckpoint: (checkpointId) => { if (checkpointId === UNIT3_FLOOR1_CART_CRASH_CHECKPOINT) playCartCrash(); },
    afterFightMessage: "전투 이벤트가 끝났다. 이동할 길을 선택하자.",
    streetProfile: "floor1",
  },
  [UNIT3_FLOOR2_ID]: {
    floorId: UNIT3_FLOOR2_ID,
    flags: { startEvent: UNIT3_FLOOR2_FLAGS.startEvent, mainFight: UNIT3_FLOOR2_FLAGS.schoolBattle, postEventTalk: UNIT3_FLOOR2_FLAGS.postEventTalk, finalStory: UNIT3_FLOOR2_FLAGS.finalStory },
    storyFlags: UNIT3_FLOOR2_STORY_FLAGS,
    prepareMap: prepareUnit3Floor2Map,
    applyProgress: applyUnit3Floor2Progress,
    stories: {
      start: UNIT3_FLOOR2_START_STORY, fightIntro: UNIT3_FLOOR2_SCHOOL_INTRO_STORY, fightAfter: UNIT3_FLOOR2_SCHOOL_AFTER_STORY,
      rooms: UNIT3_FLOOR2_STORY_ROOM_STORIES, postEvents: UNIT3_FLOOR2_POST_EVENTS_STORY, final: UNIT3_FLOOR2_FINAL_STORY,
    },
    stageId: UNIT3_FLOOR2_STAGE_ID,
    renderStage: (phase) => <Unit3Floor2Stage phase={phase} />,
    onCheckpoint: (checkpointId) => {
      if (checkpointId === UNIT3_FLOOR2_SHOUT_CHECKPOINT) playDistantShout();
      if (checkpointId === UNIT3_FLOOR2_FOOTSTEPS_CHECKPOINT) playFootsteps();
    },
    afterFightMessage: "학교를 지켜 냈다. 이동할 길을 선택하자.",
    streetProfile: "floor2-school",
    preload: preloadUnit3Floor2StageImages,
  },
};

UNIT3_STORY_FLOORS[UNIT3_FLOOR3_ID] = {
  floorId: UNIT3_FLOOR3_ID,
  flags: { startEvent: UNIT3_FLOOR3_FLAGS.startEvent, mainFight: UNIT3_FLOOR3_FLAGS.midEvent, postEventTalk: UNIT3_FLOOR3_FLAGS.postEventTalk, finalStory: UNIT3_FLOOR3_FLAGS.finalStory },
  storyFlags: UNIT3_FLOOR3_STORY_FLAGS,
  prepareMap: prepareUnit3Floor3Map,
  applyProgress: applyUnit3Floor3Progress,
  stories: {
    start: UNIT3_FLOOR3_START_STORY, fightIntro: UNIT3_FLOOR3_MID_STORY, fightAfter: UNIT3_FLOOR3_MID_STORY,
    rooms: UNIT3_FLOOR3_STORY_ROOM_STORIES, postEvents: UNIT3_FLOOR3_POST_EVENTS_STORY, final: UNIT3_FLOOR3_EVENT_MAP_SEGMENTS.safeAlley,
  },
  stageId: UNIT3_FLOOR3_STAGE_ID,
  renderStage: (phase) => <Unit3Floor3Stage phase={phase} />,
  onCheckpoint: () => undefined,
  afterFightMessage: "이동할 길을 선택하자.",
  streetProfile: "floor1",
  // Story illustrations, portraits and every event-map image are decoded when the run starts, so the final
  // cutscene never waits on the network.
  preload: () => preloadImages([...UNIT3_FLOOR3_STAGE_IMAGE_URLS, ...UNIT3_FLOOR3_PORTRAIT_URLS, ...U3EM_IMAGE_URLS]),
  mainEventFightless: true,
  renderFinal: ({ playerName, playerStatus, onComplete }) => (
    <Unit3Floor3EventMap playerName={playerName} playerStatus={playerStatus as never} onComplete={onComplete} />
  ),
  investigationPlaces: UNIT3_FLOOR3_INVESTIGATION_PLACES,
};

export function getUnit3StoryFloor(floorId: string): Unit3StoryFloor | null {
  return UNIT3_STORY_FLOORS[floorId] ?? null;
}

export function allUnit3StoryEventsDone(floor: Unit3StoryFloor, flags: Unit3Flags): boolean {
  return floor.storyFlags.every((flag) => flags[flag] === true);
}
