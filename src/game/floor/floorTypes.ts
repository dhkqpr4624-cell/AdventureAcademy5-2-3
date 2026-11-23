export type FloorId = "floor-1" | "floor-2" | "floor-3" | "floor-4" | "floor-5" | "floor-6" | "floor-7" | "floor-8" | "floor-9" | "floor-10"
  /** Unit 3 (Chapter 3) Floor 1 — 을사늑약과 항일 의병 운동. */
  | "unit3-floor-1";

export type FloorDefinition = {
  id: FloorId;
  order: number;
  title: string;
  questId: string;
  questionCount: number;
};

export type FloorUnlockState = {
  unlockedFloorIds: FloorId[];
};

export type UnlockFloorResult = {
  success: boolean;
  changed: boolean;
  nextState: FloorUnlockState;
  reason?: "floorNotFound";
};
