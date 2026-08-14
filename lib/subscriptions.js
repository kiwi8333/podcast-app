const STORAGE_KEY = "podcast-app:subscriptions-meta";
const CHECK_THROTTLE_MS = 15 * 60 * 1000;

function readAll() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(meta) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
}

export function getSubscriptionMeta(feedUrl) {
  return readAll()[feedUrl] || null;
}

export function shouldCheckFeed(feedUrl) {
  const meta = getSubscriptionMeta(feedUrl);
  if (!meta?.lastCheckedAt) return true;
  return Date.now() - meta.lastCheckedAt >= CHECK_THROTTLE_MS;
}

export function recordCheck(feedUrl, lastKnownGuid) {
  const all = readAll();
  all[feedUrl] = { ...all[feedUrl], lastKnownGuid, lastCheckedAt: Date.now() };
  writeAll(all);
}

export function markSeen(feedUrl, guid) {
  if (!guid) return;
  const all = readAll();
  all[feedUrl] = { ...all[feedUrl], lastSeenGuid: guid };
  writeAll(all);
}

export function hasNewEpisode(feedUrl) {
  const meta = getSubscriptionMeta(feedUrl);
  if (!meta?.lastKnownGuid) return false;
  // "Never seen before" (no lastSeenGuid yet) isn't "new" — otherwise every
  // existing subscription would light up on the first load after upgrade.
  if (!meta.lastSeenGuid) return false;
  return meta.lastKnownGuid !== meta.lastSeenGuid;
}
