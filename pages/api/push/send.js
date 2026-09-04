import webpush from "web-push";
import crypto from "node:crypto";
import { readState, writeState } from "@/lib/push/store";
import { parseFeed } from "@/lib/rssParser";

export const config = { maxDuration: 60 };

const FEED_CONCURRENCY = 5;
const SEND_CONCURRENCY = 10;
const MAX_WRITE_ATTEMPTS = 3;

// Constant-time compare, so response latency can't be used to walk the
// secret. Hashing first keeps timingSafeEqual from throwing on a length
// mismatch — which would leak the secret's length on its own.
function timingSafeEqualStrings(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const digest = (value) => crypto.createHash("sha256").update(value).digest();
  return crypto.timingSafeEqual(digest(a), digest(b));
}

async function pool(items, limit, worker) {
  let cursor = 0;
  async function run() {
    while (cursor < items.length) await worker(items[cursor++]);
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}

export default async function handler(req, res) {
  // Vercel sends this header on cron-triggered requests when CRON_SECRET is
  // set. It is a real shared secret, unlike an "is this a cron" header,
  // which any caller could set themselves.
  //
  // An unset CRON_SECRET used to be an open door: the expected value was
  // built by interpolation, so with the variable missing this asked for the
  // literal string "Bearer undefined" — which anyone can send. A missing
  // secret now fails closed instead of accepting a guessable placeholder.
  if (!process.env.CRON_SECRET) {
    console.error("push/send: CRON_SECRET is not set; refusing to run.");
    res.status(503).json({ error: "Push is not configured" });
    return;
  }
  if (!timingSafeEqualStrings(req.headers.authorization, `Bearer ${process.env.CRON_SECRET}`)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    res.status(503).json({ error: "Push is not configured" });
    return;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:noreply@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const { state, etag } = await readState();
  if (state.subscriptions.length === 0) {
    res.status(200).json({ checked: 0, sent: 0 });
    return;
  }

  // Fetch each distinct feed once per run, not once per subscriber — two
  // people following the same show should cost one request, not two.
  const feedUrls = [...new Set(state.subscriptions.flatMap((s) => s.feeds ?? []))];
  const feedState = { ...state.feeds };

  await pool(feedUrls, FEED_CONCURRENCY, async (url) => {
    const previous = feedState[url] ?? {};
    try {
      const feed = await parseFeed(url, { etag: previous.etag, lastModified: previous.lastModified });
      if (feed.notModified) return; // nothing changed; keep what we had
      const newest = feed.episodes?.[0];
      feedState[url] = {
        etag: feed.etag ?? null,
        lastModified: feed.lastModified ?? null,
        newestGuid: newest?.guid ?? previous.newestGuid ?? null,
        newestTitle: newest?.title ?? null,
        title: feed.title ?? previous.title ?? null,
      };
    } catch (err) {
      // One unreachable feed must not abort the run for every other feed.
      console.error(`push/send: feed failed (${url}):`, err.message ?? err);
    }
  });

  const removed = new Set();
  const seenUpdates = new Map(); // endpoint -> { feedUrl: guid }
  let sent = 0;

  await pool(state.subscriptions, SEND_CONCURRENCY, async (sub) => {
    const fresh = [];
    for (const url of sub.feeds ?? []) {
      const info = feedState[url];
      if (!info?.newestGuid) continue;
      if (sub.seen?.[url] === info.newestGuid) continue;
      fresh.push({ url, info });
    }
    if (fresh.length === 0) return;

    // One notification per run, not one per episode — waking someone's phone
    // five times because five shows published is how an app gets muted.
    const first = fresh[0];
    const title =
      fresh.length === 1 ? first.info.title || "New episode" : `${fresh.length} new episodes`;
    const body =
      fresh.length === 1
        ? first.info.newestTitle || "A new episode is available"
        : fresh.map((f) => f.info.title).filter(Boolean).join(", ");
    const url = fresh.length === 1 ? `/podcast/${encodeURIComponent(first.url)}` : "/favorites";

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify({ title, body, url })
      );
      sent += 1;
      seenUpdates.set(sub.endpoint, Object.fromEntries(fresh.map((f) => [f.url, f.info.newestGuid])));
    } catch (err) {
      // 404/410 mean the browser revoked this subscription — drop it.
      // Anything else, leave it alone and retry next run, but log it: a
      // persistent failure (bad VAPID keys) would otherwise stop every
      // notification with nothing in the logs to say why.
      if (err.statusCode === 404 || err.statusCode === 410) removed.add(sub.endpoint);
      else console.error(`push/send: failed for ${sub.endpoint} (${err.statusCode ?? "?"}):`, err.message ?? err);
    }
  });

  // Notifications have already gone out, so a lost write race cannot be
  // fixed by blindly retrying the same document — that risks re-sending on
  // the next tick. Re-read and reapply only this run's outcomes on top.
  let currentState = state;
  let currentEtag = etag;
  for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt++) {
    const next = {
      feeds: { ...currentState.feeds, ...feedState },
      subscriptions: currentState.subscriptions
        .filter((s) => !removed.has(s.endpoint))
        .map((s) =>
          seenUpdates.has(s.endpoint)
            ? { ...s, seen: { ...(s.seen ?? {}), ...seenUpdates.get(s.endpoint) } }
            : s
        ),
    };
    try {
      await writeState(next, currentEtag);
      break;
    } catch (err) {
      if (attempt === MAX_WRITE_ATTEMPTS) throw err;
      ({ state: currentState, etag: currentEtag } = await readState());
    }
  }

  res.status(200).json({ checked: state.subscriptions.length, feeds: feedUrls.length, sent });
}
