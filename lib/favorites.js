import { useEffect, useState } from "react";
import {
  shouldCheckFeed,
  recordCheck,
  touchCheck,
  hasNewEpisode,
  getSubscriptionMeta,
} from "./subscriptions";

const STORAGE_KEY = "podcast-app:favorites";
// Polls while the tab stays open. Shorter than the 15-minute throttle in
// subscriptions.js on purpose: this only decides how often we *consider*
// checking, and the throttle decides whether anything is actually fetched.
const RECHECK_INTERVAL_MS = 5 * 60 * 1000;

function readAll() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(favorites) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
}

export function getFavorites() {
  return readAll();
}

export function isFavorite(feedUrl) {
  return readAll().some((f) => f.feedUrl === feedUrl);
}

export function addFavorite(podcast) {
  const favorites = readAll();
  if (favorites.some((f) => f.feedUrl === podcast.feedUrl)) return;
  writeAll([...favorites, podcast]);
}

export function removeFavorite(feedUrl) {
  writeAll(readAll().filter((f) => f.feedUrl !== feedUrl));
}

export function toggleFavorite(podcast) {
  if (isFavorite(podcast.feedUrl)) {
    removeFavorite(podcast.feedUrl);
    return false;
  }
  addFavorite(podcast);
  return true;
}

export function useFavorite(podcast) {
  const [favorited, setFavorited] = useState(false);

  useEffect(() => {
    // Hydrate from localStorage after mount to avoid an SSR mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFavorited(isFavorite(podcast.feedUrl));
  }, [podcast.feedUrl]);

  function toggle() {
    setFavorited(toggleFavorite(podcast));
  }

  return [favorited, toggle];
}

export function useFavoritesList() {
  const [favorites, setFavorites] = useState([]);

  function refresh() {
    setFavorites(
      getFavorites().map((f) => ({ ...f, hasNewEpisode: hasNewEpisode(f.feedUrl) }))
    );
  }

  useEffect(() => {
    // Hydrate from localStorage after mount to avoid an SSR mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, []);

  useEffect(() => {
    if (favorites.length === 0) return;
    let cancelled = false;

    async function checkOne(podcast) {
      try {
        // Send back whatever the origin last gave us. An unchanged feed then
        // costs a 304 with an empty body instead of the whole document.
        const meta = getSubscriptionMeta(podcast.feedUrl);
        const headers = {};
        if (meta?.etag) headers["If-None-Match"] = meta.etag;
        if (meta?.lastModified) headers["If-Modified-Since"] = meta.lastModified;

        const res = await fetch(`/api/feed?url=${encodeURIComponent(podcast.feedUrl)}`, { headers });

        if (res.status === 304) {
          touchCheck(podcast.feedUrl);
          return;
        }
        if (!res.ok) return;

        const data = await res.json();
        const newestGuid = data.episodes?.[0]?.guid;
        if (newestGuid) {
          recordCheck(podcast.feedUrl, newestGuid, {
            etag: data.etag,
            lastModified: data.lastModified,
          });
        }
      } catch {
        // Network error — leave lastCheckedAt untouched so this feed is retried next load.
      }
    }

    async function checkForNewEpisodes() {
      const due = favorites.filter((p) => shouldCheckFeed(p.feedUrl));
      if (due.length === 0) return;

      // Previously awaited each feed in turn, so twenty subscriptions meant
      // twenty sequential round-trips and one slow feed blocked the rest.
      // Bounded rather than a bare Promise.all: these all hit our own
      // /api/feed, and firing fifty at once would just queue in the browser
      // and hammer the function.
      const CONCURRENCY = 5;
      let cursor = 0;
      async function worker() {
        while (cursor < due.length && !cancelled) {
          await checkOne(due[cursor++]);
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, due.length) }, worker));

      if (!cancelled) refresh();
    }

    checkForNewEpisodes();

    // Previously this ran once per app load and never again, so a session
    // left open — which is exactly how a player gets used — never saw a new
    // episode. Every path below still goes through shouldCheckFeed, so the
    // 15-minute throttle stays in charge of what actually hits the network.
    function recheck() {
      if (!cancelled) checkForNewEpisodes();
    }
    function onVisible() {
      if (document.visibilityState === "visible") recheck();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", recheck);
    const timer = setInterval(recheck, RECHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", recheck);
      clearInterval(timer);
    };
    // favorites.length (not `favorites`) is deliberate: `favorites` gets a new
    // array reference on every refresh(), which would otherwise re-trigger
    // this effect in a loop. Re-check only when the subscribed set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favorites.length]);

  function remove(feedUrl) {
    removeFavorite(feedUrl);
    refresh();
  }

  return [favorites, remove, refresh];
}
