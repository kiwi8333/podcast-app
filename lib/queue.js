import { useEffect, useState } from "react";

const STORAGE_KEY = "podcast-app:queue";

function readAll() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(queue) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function getQueue() {
  return readAll();
}

export function addToQueue(episode) {
  const queue = readAll();
  if (queue.some((e) => e.audioUrl === episode.audioUrl)) return;
  writeAll([
    ...queue,
    {
      audioUrl: episode.audioUrl,
      title: episode.title,
      podcastTitle: episode.podcastTitle,
      artwork: episode.artwork,
    },
  ]);
}

export function removeFromQueue(audioUrl) {
  writeAll(readAll().filter((e) => e.audioUrl !== audioUrl));
}

export function clearQueue() {
  writeAll([]);
}

export function isQueued(audioUrl) {
  return readAll().some((e) => e.audioUrl === audioUrl);
}

export function useQueue() {
  const [queue, setQueue] = useState([]);

  function refresh() {
    setQueue(getQueue());
  }

  useEffect(() => {
    // Hydrate from localStorage after mount to avoid an SSR mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, []);

  function add(episode) {
    addToQueue(episode);
    refresh();
  }

  function remove(audioUrl) {
    removeFromQueue(audioUrl);
    refresh();
  }

  function clear() {
    clearQueue();
    refresh();
  }

  return [queue, add, remove, clear];
}
