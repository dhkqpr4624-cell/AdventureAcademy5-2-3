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
  floorId: typeof UNIT3_FLOOR1_ID | typeof UNIT3_FLOOR2_ID;
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

export function getUnit3StoryFloor(floorId: string): Unit3StoryFloor | null {
  return UNIT3_STORY_FLOORS[floorId] ?? null;
}

export function allUnit3StoryEventsDone(floor: Unit3StoryFloor, flags: Unit3Flags): boolean {
  return floor.storyFlags.every((flag) => flags[flag] === true);
}
