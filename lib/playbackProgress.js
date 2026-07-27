import { useEffect, useState } from "react";

const STORAGE_KEY = "podcast-app:progress";

function readAll() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(all) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function getProgress(audioUrl) {
  return readAll()[audioUrl] || null;
}

export function getAllProgress() {
  return readAll();
}

export function setProgress(audioUrl, data) {
  const all = readAll();
  all[audioUrl] = { ...all[audioUrl], ...data, updatedAt: Date.now() };
  writeAll(all);
}

export function clearProgress(audioUrl) {
  const all = readAll();
  delete all[audioUrl];
  writeAll(all);
}

export function useContinueListening() {
  const [episodes, setEpisodes] = useState([]);

  useEffect(() => {
    const all = getAllProgress();
    const inProgress = Object.entries(all)
      .map(([audioUrl, data]) => ({ audioUrl, ...data }))
      .filter((ep) => ep.duration > 0 && ep.position / ep.duration < 0.95)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    setEpisodes(inProgress);
  }, []);

  return episodes;
}
