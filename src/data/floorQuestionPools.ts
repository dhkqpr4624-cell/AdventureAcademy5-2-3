import type { FloorId } from "../game/floor/floorTypes";
import type { Question } from "../types/question";
import {
  DUNGEON1_UNIT2_QUESTIONS,
  DUNGEON2_UNIT2_QUESTIONS,
  DUNGEON3_UNIT2_QUESTIONS,
  DUNGEON4_UNIT2_QUESTIONS,
  DUNGEON5_UNIT2_QUESTIONS,
  DUNGEON6_UNIT2_QUESTIONS,
  DUNGEON7_UNIT2_QUESTIONS,
  DUNGEON8_UNIT2_QUESTIONS,
  DUNGEON9_UNIT2_QUESTIONS,
} from "./unit2Questions";

// 활성 문제 pool은 2단원 문제만 사용한다. 이전 1단원 문항(testQuestions.ts, historyQuestions.ts)은 연결하지 않는다.
/**
 * Unit 3 Floor 1 question pool — INTERIM.
 * No Unit 3 question set was supplied with Phase 2 and new questions must not be invented, so the combat
 * rooms of Unit 3 Floor 1 temporarily draw from the existing, already verified Unit 2 Floor 9 pool
 * (개항 이후 ~ 대한 제국, the period right before 을사늑약). Replace this single constant when the Unit 3
 * questions are delivered.
 */
export const UNIT3_FLOOR1_INTERIM_QUESTIONS: readonly Question[] = DUNGEON9_UNIT2_QUESTIONS;

export const FLOOR_QUESTION_POOLS: Readonly<Record<Exclude<FloorId, "floor-10">, readonly Question[]>> = {
  "floor-1": DUNGEON1_UNIT2_QUESTIONS,
  "floor-2": DUNGEON2_UNIT2_QUESTIONS,
  "floor-3": DUNGEON3_UNIT2_QUESTIONS,
  "floor-4": DUNGEON4_UNIT2_QUESTIONS,
  "floor-5": DUNGEON5_UNIT2_QUESTIONS,
  "floor-6": DUNGEON6_UNIT2_QUESTIONS,
  "floor-7": DUNGEON7_UNIT2_QUESTIONS,
  "floor-8": DUNGEON8_UNIT2_QUESTIONS,
  "floor-9": DUNGEON9_UNIT2_QUESTIONS,
  "unit3-floor-1": UNIT3_FLOOR1_INTERIM_QUESTIONS,
};

export const DUNGEON_1_TO_9_QUESTION_POOL: readonly Question[] = [
  DUNGEON1_UNIT2_QUESTIONS, DUNGEON2_UNIT2_QUESTIONS, DUNGEON3_UNIT2_QUESTIONS,
  DUNGEON4_UNIT2_QUESTIONS, DUNGEON5_UNIT2_QUESTIONS, DUNGEON6_UNIT2_QUESTIONS,
  DUNGEON7_UNIT2_QUESTIONS, DUNGEON8_UNIT2_QUESTIONS, DUNGEON9_UNIT2_QUESTIONS,
].flat();
