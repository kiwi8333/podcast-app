// Every store in here reads through a try/catch and, until now, wrote
// without one. localStorage.setItem is not a safe call: it throws
// QuotaExceededError once the origin's storage is full, and throws outright
// in Safari's private mode. The asymmetry mattered most in playbackProgress,
// where setProgress runs on playback position updates — a throw there is not
// a lost preference, it is the player raising on a timer for the rest of the
// episode.
//
// Failing to persist is worth knowing about but is never worth breaking
// playback over, so this reports false instead of throwing and logs once per
// key rather than on every write.
const warned = new Set();

export function readJson(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// Returns true when the value was stored, false when storage refused it.
export function writeJson(key, value) {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    if (!warned.has(key)) {
      warned.add(key);
      console.warn(`Could not save "${key}" — browser storage is full or unavailable.`, err);
    }
    return false;
  }
}
