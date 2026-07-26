import { useEffect, useState } from "react";

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
    setFavorited(isFavorite(podcast.feedUrl));
  }, [podcast.feedUrl]);

  function toggle() {
    setFavorited(toggleFavorite(podcast));
  }

  return [favorited, toggle];
}

export function useFavoritesList() {
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    setFavorites(getFavorites());
  }, []);

  function remove(feedUrl) {
    removeFavorite(feedUrl);
    setFavorites(getFavorites());
  }

  return [favorites, remove];
}
