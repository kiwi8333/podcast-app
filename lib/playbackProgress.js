import { useEffect, useState } from "react";
import { readJson, writeJson } from "./localStore.js";

const STORAGE_KEY = "podcast-app:progress";
// One entry is written per episode ever played and nothing removed them, so
// this map only ever grew — a slow walk toward the same storage quota whose
// exhaustion the guarded write now has to handle. Finished episodes are the
// cheapest to lose (Continue Listening already hides them), so they go first;
// only if that isn't enough do the least recently touched entries go too.
const MAX_ENTRIES = 300;
const KEEP_ENTRIES = 200;
const FINISHED_RATIO = 0.95;

function readAll() {
  return readJson(STORAGE_KEY, {});
}

function writeAll(all) {
  return writeJson(STORAGE_KEY, all);
}

// Exported for tests: prunes in place-ish (returns a new object) and is a
// pure function of its input, so the policy can be checked without a browser.
export function pruneProgress(all, { max = MAX_ENTRIES, keep = KEEP_ENTRIES } = {}) {
  const entries = Object.entries(all);
  if (entries.length <= max) return all;

  const isFinished = ([, data]) =>
    data?.duration > 0 && data.position / data.duration >= FINISHED_RATIO;
  const byRecency = (a, b) => (b[1]?.updatedAt ?? 0) - (a[1]?.updatedAt ?? 0);

  const unfinished = entries.filter((e) => !isFinished(e)).sort(byRecency);
  const finished = entries.filter(isFinished).sort(byRecency);

  // Unfinished episodes are what the feature exists to remember, so they keep
  // their places and finished ones only fill whatever room is left.
  const kept = [...unfinished.slice(0, keep), ...finished.slice(0, Math.max(0, keep - unfinished.length))];
  return Object.fromEntries(kept);
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
  writeAll(pruneProgress(all));
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
    // Hydrate from localStorage after mount to avoid an SSR mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEpisodes(inProgress);
  }, []);

  return episodes;
}
