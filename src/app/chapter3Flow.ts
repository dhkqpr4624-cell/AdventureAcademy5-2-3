import type { GameSaveState } from "../save/saveStateAdapter";
import { CHAPTER3_INTRO_STORY_ID } from "../data/chapter3/chapter3IntroScript";

/** Has the Unit 3 intro been completed in this save? */
export function isChapter3IntroCompleted(state: Pick<GameSaveState, "completedStoryIds">) {
  return state.completedStoryIds.includes(CHAPTER3_INTRO_STORY_ID);
}

/** Where "이어하기" goes: completed intro → base camp (no intro replay); otherwise the intro restarts. */
export function resolveContinueScreen(state: Pick<GameSaveState, "completedStoryIds" | "playerState">): "baseCamp" | "story" | "name" {
  if (isChapter3IntroCompleted(state)) return "baseCamp";
  return state.playerState.name?.trim() ? "story" : "name";
}

/** State written when the intro ends: completion flag added, player name kept, checkpoint cleared. */
export function completeChapter3Intro(state: GameSaveState): GameSaveState {
  const checkpointByStoryId = { ...state.checkpointByStoryId };
  delete checkpointByStoryId[CHAPTER3_INTRO_STORY_ID];
  return {
    ...state,
    playerState: { ...state.playerState, name: state.playerState.name ?? "" },
    completedStoryIds: [...new Set([...state.completedStoryIds, CHAPTER3_INTRO_STORY_ID])],
    checkpointByStoryId,
  };
}
