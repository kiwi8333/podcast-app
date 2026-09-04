import { openDB } from "idb";

// Separate database from podcast-app-downloads: that one stores audio blobs
// and is the user's own saved content, this one is disposable cache. Keeping
// them apart means clearing cached feeds can never touch a download.
const DB_NAME = "podcast-app-feeds";
const STORE_NAME = "feeds";

// Entries older than this are ignored on read. They still go back to the
// network anyway (revalidation is unconditional) — this only decides whether
// there's something worth painting first.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function getDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME, { keyPath: "feedUrl" });
    },
  });
}

export async function getCachedFeed(feedUrl) {
  try {
    const db = await getDb();
    const entry = await db.get(STORE_NAME, feedUrl);
    if (!entry) return null;
    if (Date.now() - entry.savedAt > MAX_AGE_MS) return null;
    return entry.feed;
  } catch {
    // IndexedDB can be unavailable (private mode, storage pressure). A cache
    // miss is always a safe answer.
    return null;
  }
}

export async function setCachedFeed(feedUrl, feed) {
  try {
    const db = await getDb();
    await db.put(STORE_NAME, { feedUrl, feed, savedAt: Date.now() });
  } catch {
    // Not being able to cache is not an error worth surfacing.
  }
}
