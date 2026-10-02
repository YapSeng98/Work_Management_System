import type { HistoryEntry } from "../types";

/**
 * Browser persistence for triage state, so a reload doesn't resurrect tasks
 * that were already handled. Every access is guarded: storage can be blocked
 * (private windows, cleared site data) and the app must still work without it.
 */

const HISTORY_KEY = "daily-brief:history";
const TRIAGE_KEY = "daily-brief:triage";

/** Candidate id → ISO date it stays hidden until ("9999-12-31" = permanently). */
export type TriageState = Record<string, string>;

export const HIDE_FOREVER = "9999-12-31";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable — state just won't survive a reload.
  }
}

export const loadHistory = (fallback: HistoryEntry[]) => read(HISTORY_KEY, fallback);
export const saveHistory = (entries: HistoryEntry[]) => write(HISTORY_KEY, entries);

export const loadTriage = () => read<TriageState>(TRIAGE_KEY, {});
export const saveTriage = (state: TriageState) => write(TRIAGE_KEY, state);

/** True if the candidate should currently be hidden from the triage list. */
export function isHidden(state: TriageState, id: string, today: string) {
  const until = state[id];
  return until !== undefined && today < until;
}
