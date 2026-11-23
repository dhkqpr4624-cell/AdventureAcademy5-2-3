/**
 * Unit 3 keeps its own localStorage namespace. Unit 2 used "adventure-academy:save:*"; those keys are never
 * read, written or cleared by this build (see UNIT2_SAVE_STORAGE_KEYS / checks).
 */
export const SAVE_STORAGE_KEYS = {
  main: "adventure-academy-unit3:save:main",
  backup1: "adventure-academy-unit3:save:backup:1",
  backup2: "adventure-academy-unit3:save:backup:2",
  backup3: "adventure-academy-unit3:save:backup:3",
} as const;

/** Unit 2 keys — listed only so checks can assert they are untouched. */
export const UNIT2_SAVE_STORAGE_KEYS = [
  "adventure-academy:save:main",
  "adventure-academy:save:backup:1",
  "adventure-academy:save:backup:2",
  "adventure-academy:save:backup:3",
] as const;
