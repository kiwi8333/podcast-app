import { readJson, writeJson } from "./localStore.js";

const STORAGE_KEY = "podcast-app:subscriptions-meta";
const CHECK_THROTTLE_MS = 15 * 60 * 1000;

function readAll() {
  return readJson(STORAGE_KEY, {});
}

function writeAll(meta) {
  return writeJson(STORAGE_KEY, meta);
}

export function getSubscriptionMeta(feedUrl) {
  return readAll()[feedUrl] || null;
}

export function shouldCheckFeed(feedUrl) {
  const meta = getSubscriptionMeta(feedUrl);
  if (!meta?.lastCheckedAt) return true;
  return Date.now() - meta.lastCheckedAt >= CHECK_THROTTLE_MS;
}

export function recordCheck(feedUrl, lastKnownGuid, validators = {}) {
  const all = readAll();
  all[feedUrl] = {
    ...all[feedUrl],
    lastKnownGuid,
    lastCheckedAt: Date.now(),
    // Kept so the next poll can ask the origin "only send this if it changed".
    etag: validators.etag ?? all[feedUrl]?.etag ?? null,
    lastModified: validators.lastModified ?? all[feedUrl]?.lastModified ?? null,
  };
  writeAll(all);
}

// The origin answered 304: nothing changed, so only the throttle clock moves.
// Deliberately does not touch lastKnownGuid — there is no new guid to record.
export function touchCheck(feedUrl) {
  const all = readAll();
  all[feedUrl] = { ...all[feedUrl], lastCheckedAt: Date.now() };
  writeAll(all);
}

export function markSeen(feedUrl, guid) {
  if (!guid) return;
  const all = readAll();
  all[feedUrl] = { ...all[feedUrl], lastSeenGuid: guid };
  writeAll(all);
}

// Episodes published since the last time this feed's page was opened, newest
// first. Feeds are assumed newest-first (same assumption as the badge check).
export function getNewEpisodes(feedUrl, episodes) {
  const lastSeenGuid = getSubscriptionMeta(feedUrl)?.lastSeenGuid;
  if (!lastSeenGuid) return episodes.slice(0, 3); // never visited — cap instead of dumping the whole feed
  const newOnes = [];
  for (const episode of episodes) {
    if (episode.guid === lastSeenGuid) break;
    newOnes.push(episode);
  }
  return newOnes;
}

export function hasNewEpisode(feedUrl) {
  const meta = getSubscriptionMeta(feedUrl);
  if (!meta?.lastKnownGuid) return false;
  // "Never seen before" (no lastSeenGuid yet) isn't "new" — otherwise every
  // existing subscription would light up on the first load after upgrade.
  if (!meta.lastSeenGuid) return false;
  return meta.lastKnownGuid !== meta.lastSeenGuid;
}
