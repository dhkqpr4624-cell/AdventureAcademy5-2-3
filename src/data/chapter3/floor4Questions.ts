import type { Question } from "../../types/question";
import { DUNGEON9_UNIT2_QUESTIONS } from "../unit2Questions";

/**
 * Unit 3 Floor 4 (3·1 운동과 대한민국 임시정부) question pool — **INTERIM / 임시 데이터 (Phase 5)**.
 *
 * No Floor 4 question file was supplied and history questions must not be invented, so the shield defense
 * temporarily uses the same already verified pool and format as the Floor 1–3 interim data (2단원 9층 문항,
 * 20 questions — enough for 12 different questions per attempt). Replace this ONE constant with the real
 * Floor 4 questions; Floors 1–3 are untouched and achievement progress counts only ids present in this pool.
 */
export const UNIT3_FLOOR4_QUESTIONS_ARE_INTERIM = true;
export const UNIT3_FLOOR4_QUESTIONS: readonly Question[] = DUNGEON9_UNIT2_QUESTIONS;

/** 12 different questions for one attempt, freshly shuffled each time (each retry draws again). */
export function drawUnit3Floor4Questions(count = 12, random: () => number = Math.random): Question[] {
  const pool = [...UNIT3_FLOOR4_QUESTIONS];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}
