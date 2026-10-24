/**
 * Earlier versions kept the brief, tasks and history in localStorage under these
 * keys. That data is superseded (tasks now live in the Planner), so remove it once.
 */
const LEGACY_KEYS = ["daily-brief:history", "daily-brief:triage", "daily-brief:brief-text", "daily-brief:my-tasks"];

export function clearLegacyStorage() {
  try {
    for (const key of LEGACY_KEYS) localStorage.removeItem(key);
  } catch {
    // Storage blocked — nothing to clear.
  }
}

/** Browser fallback for brief data while the brief_* tables don't exist yet. */
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`dbrief-local:${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function clearLocal() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith("dbrief-local:")) localStorage.removeItem(key);
  } catch {
    // Storage blocked — nothing to clear.
  }
}

export function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(`dbrief-local:${key}`, JSON.stringify(value));
  } catch {
    // Storage unavailable — the data just won't survive a reload.
  }
}
