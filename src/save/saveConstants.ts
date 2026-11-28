/**
 * Phase 5 · save isolation. Unit 3 (AdventureAcademy5-2-3) keeps its own localStorage namespace, named after the
 * repository so no other unit build on the same origin (github.io) can share it, and every save it writes carries
 * `saveUnit` (see SaveManager). Other units' keys are never read, written or cleared by this build.
 */
export const UNIT3_SAVE_UNIT_ID = "AdventureAcademy5-2-3";
export const SAVE_STORAGE_KEYS = {
  main: "adventure-academy-5-2-3:save:main",
  backup1: "adventure-academy-5-2-3:save:backup:1",
  backup2: "adventure-academy-5-2-3:save:backup:2",
  backup3: "adventure-academy-5-2-3:save:backup:3",
} as const;
/** Set once the one-time copy from the Phase 1–4 keys was attempted (kept by 새로 시작하기, so it never re-runs). */
export const LEGACY_MIGRATION_DONE_KEY = "adventure-academy-5-2-3:save:legacy-migrated";
/**
 * Phase 1–4 Unit 3 keys. Read once (copied only when the data is certainly Unit 3 and the new slots are empty),
 * never written, never deleted.
 */
export const LEGACY_UNIT3_SAVE_STORAGE_KEYS = {
  main: "adventure-academy-unit3:save:main",
  backup1: "adventure-academy-unit3:save:backup:1",
  backup2: "adventure-academy-unit3:save:backup:2",
  backup3: "adventure-academy-unit3:save:backup:3",
} as const;
/** Debug Mode session save (sessionStorage only). */
export const DEBUG_SESSION_SAVE_KEY = "adventure-academy-5-2-3:debug-session";

/** Unit 1 / Unit 2 keys — listed only so checks can assert they are untouched. */
export const UNIT2_SAVE_STORAGE_KEYS = [
  "adventure-academy:save:main",
  "adventure-academy:save:backup:1",
  "adventure-academy:save:backup:2",
  "adventure-academy:save:backup:3",
] as const;
