import { useEffect, useState } from "react";
import { shouldCheckFeed, recordCheck, hasNewEpisode } from "./subscriptions";

const STORAGE_KEY = "podcast-app:favorites";

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

    async function checkForNewEpisodes() {
      let checkedAny = false;
      for (const podcast of favorites) {
        if (!shouldCheckFeed(podcast.feedUrl)) continue;
        checkedAny = true;
        try {
          const res = await fetch(`/api/feed?url=${encodeURIComponent(podcast.feedUrl)}`);
          if (!res.ok) continue;
          const data = await res.json();
          const newestGuid = data.episodes?.[0]?.guid;
          if (newestGuid) recordCheck(podcast.feedUrl, newestGuid);
        } catch {
          // Network error — leave lastCheckedAt untouched so this feed is retried next load.
        }
      }
      if (!cancelled && checkedAny) refresh();
    }

    checkForNewEpisodes();
    return () => {
      cancelled = true;
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
