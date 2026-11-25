import type { StorySequence } from "../../types/story";

/** 보급물품 비상 지원 — the three narration lines, in order; the potions are handed out after the last one. */
export const EMERGENCY_SUPPLY_STORY: StorySequence = {
  id: "unit3-emergency-supply",
  title: "보급 물품 상자",
  replayable: true,
  skippable: false,
  dialogueSkip: true,
  onCompleteScreen: "baseCamp",
  backgrounds: {},
  actors: {},
  scenes: [{
    id: "unit3-emergency-supply-scene",
    steps: [
      { id: "u3-supply-1", type: "narration", text: "보급 물품 상자 속에서 한숨 소리가 들린 듯하다.", advanceMode: "click" },
      { id: "u3-supply-2", type: "narration", text: "보급 물품 상자가 당신의 재산 상태를 안타까워 한다.", advanceMode: "click" },
      { id: "u3-supply-3", type: "narration", text: "보급 물품 상자가 포션을 뱉어냈다! 아싸!", advanceMode: "click" },
    ],
  }],
};
