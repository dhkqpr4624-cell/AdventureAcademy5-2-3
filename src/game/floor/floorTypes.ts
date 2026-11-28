export type FloorId = "floor-1" | "floor-2" | "floor-3" | "floor-4" | "floor-5" | "floor-6" | "floor-7" | "floor-8" | "floor-9" | "floor-10"
  /** Unit 3 (Chapter 3) Floor 1 — 을사늑약과 항일 의병 운동. */
  | "unit3-floor-1"
  /** Unit 3 Floor 2 — 일제 침략에 맞선 다양한 노력(애국계몽운동과 의거 활동). */
  | "unit3-floor-2"
  | "unit3-floor-3"
  | "unit3-floor-4";

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
