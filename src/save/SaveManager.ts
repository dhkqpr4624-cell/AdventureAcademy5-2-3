import { DEBUG_SESSION_SAVE_KEY, LEGACY_MIGRATION_DONE_KEY, LEGACY_UNIT3_SAVE_STORAGE_KEYS as LEGACY, SAVE_STORAGE_KEYS as K, UNIT3_SAVE_UNIT_ID } from "./saveConstants";
import { migrateSaveData } from "./SaveMigration";
import type { CurrentSaveData, ImportResult, LoadResult, SaveReason, SaveResult, SaveSource } from "./saveTypes";

const storage = () => { try { return window.localStorage; } catch { return null; } };
/**
 * Phase 5: is this raw save Unit 3's? A save written by this build carries `saveUnit`; one without it (Phase 1–4
 * keys, an exported file) must show Unit 3 progress — the Unit 3 intro, a Unit 3 quest / floor / story flag.
 * A version number or a floor number alone is not enough (Unit 1–2 saves use the same schema).
 */
export function isUnit3RawSave(raw: unknown): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const value = raw as Record<string, unknown>;
  if (value.saveUnit !== undefined) return value.saveUnit === UNIT3_SAVE_UNIT_ID;
  const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const story = obj(value.story), quests = obj(value.quests), floors = obj(value.floors), dungeon = obj(value.dungeon), progress = obj(value.questProgress);
  const unit3Id = (id: string) => id.startsWith("unit3-") || id.startsWith("quest-unit3-") || id.startsWith("chapter3-");
  return list(story.completedStoryIds).some(unit3Id) || Object.keys(obj(story.checkpointByStoryId)).some(unit3Id)
    || Object.keys(obj(quests.statuses)).some(unit3Id) || list(floors.unlockedFloorIds).some(unit3Id)
    || list(dungeon.clearedFloorIds).some(unit3Id) || Object.keys(obj(progress.firstObjectiveEventSeen)).some(unit3Id);
}
const parse = (text: string | null): ImportResult => {
  if (text === null) return { success: false, reason: "notFound" };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { success: false, reason: "invalidJson" }; }
  // another unit's save is never read as Unit 3's (이어하기 / backups / import)
  if (!isUnit3RawSave(raw)) return { success: false, reason: "invalidSchema" };
  return migrateSaveData(raw);
};
const serializeUnit3 = (data: CurrentSaveData) => JSON.stringify({ ...data, saveUnit: UNIT3_SAVE_UNIT_ID });

/**
 * Phase 5 · one-time copy from the Phase 1–4 keys: only when none of the new slots holds anything and the old
 * data is certainly Unit 3; the old keys are never deleted or changed. Runs at most once per browser.
 */
export function migrateLegacyUnit3Save(target: Storage | null = storage()): { copied: number } {
  if (!target) return { copied: 0 };
  try {
    if (target.getItem(LEGACY_MIGRATION_DONE_KEY) !== null) return { copied: 0 };
    const pairs = [[LEGACY.main, K.main], [LEGACY.backup1, K.backup1], [LEGACY.backup2, K.backup2], [LEGACY.backup3, K.backup3]] as const;
    if (pairs.some(([, next]) => target.getItem(next) !== null)) { target.setItem(LEGACY_MIGRATION_DONE_KEY, "1"); return { copied: 0 }; }
    let copied = 0;
    for (const [old, next] of pairs) {
      const text = target.getItem(old);
      if (text === null) continue;
      let raw: unknown;
      try { raw = JSON.parse(text); } catch { continue; }
      if (raw && typeof raw === "object" && !Array.isArray(raw) && (raw as { saveUnit?: unknown }).saveUnit === undefined && isUnit3RawSave(raw)) {
        const result = migrateSaveData(raw);
        if (result.success) { target.setItem(next, serializeUnit3(result.data)); copied += 1; }
      }
    }
    target.setItem(LEGACY_MIGRATION_DONE_KEY, "1");
    return { copied };
  } catch { return { copied: 0 }; }
}
const keyForSource = (source: SaveSource) => source === "main" ? K.main : K[`backup${source.slice(-1)}` as "backup1"];
const quota = (error: unknown) => error instanceof DOMException && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED");

export function planBackupRotation(main: string | null, backup1: string | null, backup2: string | null) {
  return { backup1: main, backup2: backup1, backup3: backup2 };
}

/**
 * Phase 4 hotfix · Debug Mode: while a debug session runs, every save (auto saves included) goes to a
 * sessionStorage-only key (Unit 3 namespace), so the normal save and its backups are never touched.
 */
export { DEBUG_SESSION_SAVE_KEY };
let debugSession = false;
export const setSaveDebugSession = (active: boolean) => { debugSession = active; };
export const isSaveDebugSession = () => debugSession;

export const SaveManager = {
  save(data: CurrentSaveData, _reason: SaveReason = "manual"): SaveResult {
    let serialized: string;
    try { serialized = serializeUnit3(data); } catch (error) { return { success: false, reason: "serializationFailed", error }; }
    if (debugSession) {
      try { window.sessionStorage.setItem(DEBUG_SESSION_SAVE_KEY, serialized); } catch { /* debug only */ }
      return { success: true, savedAt: data.savedAt, skipped: false };
    }
    const target = storage();
    if (!target) return { success: false, reason: "storageUnavailable" };
    try {
      const current = target.getItem(K.main);
      const validCurrent = parse(current).success;
      if (validCurrent && current !== serialized) {
        const b1 = target.getItem(K.backup1), b2 = target.getItem(K.backup2);
        const rotation = planBackupRotation(current, b1, b2);
        if (rotation.backup3 !== null) target.setItem(K.backup3, rotation.backup3);
        if (rotation.backup2 !== null) target.setItem(K.backup2, rotation.backup2);
        target.setItem(K.backup1, rotation.backup1!);
      }
      target.setItem(K.main, serialized);
      return { success: true, savedAt: data.savedAt, skipped: current === serialized };
    } catch (error) {
      return { success: false, reason: quota(error) ? "quotaExceeded" : "unknown", error };
    }
  },
  loadMain(): LoadResult {
    const target = storage(); if (!target) return { success: false, reason: "notFound" };
    migrateLegacyUnit3Save(target);
    const result = parse(target.getItem(K.main));
    return result.success ? { ...result, source: "main" } : result;
  },
  loadBackup(index: 1 | 2 | 3): LoadResult {
    const target = storage(); if (!target) return { success: false, reason: "notFound" };
    const source = `backup-${index}` as SaveSource; const result = parse(target.getItem(keyForSource(source)));
    return result.success ? { ...result, source } : result;
  },
  load(): LoadResult {
    const main = this.loadMain(); if (main.success) return main;
    for (const index of [1, 2, 3] as const) { const backup = this.loadBackup(index); if (backup.success) return backup; }
    return { success: false, reason: main.reason === "notFound" ? "notFound" : "allBackupsInvalid" };
  },
  restoreBackup(index: 1 | 2 | 3): LoadResult {
    const result = this.loadBackup(index); if (!result.success) return result;
    const saved = this.save({ ...result.data, savedAt: new Date().toISOString() }, "manual");
    return saved.success ? result : { success: false, reason: "migrationFailed" };
  },
  exportJson(data?: CurrentSaveData) {
    const candidate = data ?? (this.load().success ? (this.load() as Extract<LoadResult, {success:true}>).data : null);
    if (!candidate) return { success: false as const, reason: "notFound" as const };
    try { return { success: true as const, json: JSON.stringify({ ...candidate, saveUnit: UNIT3_SAVE_UNIT_ID }, null, 2) }; } catch { return { success: false as const, reason: "invalidSchema" as const }; }
  },
  importJson(jsonText: string): ImportResult {
    const result = parse(jsonText); if (!result.success) return result;
    const saved = this.save({ ...result.data, savedAt: new Date().toISOString() }, "imported");
    return saved.success ? { ...result, data: { ...result.data, savedAt: saved.savedAt } } : { success: false, reason: "migrationFailed" };
  },
  clear() {
    if (debugSession) return { success: true as const };
    const target = storage(); if (!target) return { success: false as const, reason: "storageUnavailable" as const };
    // only this unit's save slots (no localStorage.clear(); old Unit 3 keys and other units' keys stay as they are)
    try { Object.values(K).forEach((key) => target.removeItem(key)); target.setItem(LEGACY_MIGRATION_DONE_KEY, "1"); return { success: true as const }; }
    catch (error) { return { success: false as const, reason: "unknown" as const, error }; }
  },
  getMetadata() {
    const sources: SaveSource[] = ["main", "backup-1", "backup-2", "backup-3"];
    return sources.map((source) => { const result = source === "main" ? this.loadMain() : this.loadBackup(Number(source.slice(-1)) as 1|2|3); return { source, valid: result.success, savedAt: result.success ? result.data.savedAt : null }; });
  },
};
