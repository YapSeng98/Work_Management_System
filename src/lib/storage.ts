/**
 * Earlier versions kept the brief, tasks and history in localStorage. Everything
 * now lives in Supabase, so wipe those leftovers once on startup.
 */
export function clearLegacyStorage() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("daily-brief:")) localStorage.removeItem(key);
    }
  } catch {
    // Storage blocked — nothing to clear.
  }
}
