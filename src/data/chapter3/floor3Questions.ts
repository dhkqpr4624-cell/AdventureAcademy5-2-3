import type { Question } from "../../types/question";
import { DUNGEON9_UNIT2_QUESTIONS } from "../unit2Questions";

/**
 * Unit 3 Floor 3 (일제의 식민 통치와 달라진 생활) question pool — **INTERIM / 임시 데이터 (Phase 4)**.
 *
 * No Floor 3 question file was supplied and history questions must not be invented, so Floor 3 combats
 * temporarily use the same already verified pool and format as the Floor 1–2 interim data (2단원 9층 문항).
 * This module exists so the real Floor 3 questions can replace ONE constant without touching Floors 1–2.
 * Achievement progress counts only ids present in this pool (per floor), so replacing it is safe.
 */
export const UNIT3_FLOOR3_QUESTIONS_ARE_INTERIM = true;
export const UNIT3_FLOOR3_QUESTIONS: readonly Question[] = DUNGEON9_UNIT2_QUESTIONS;
