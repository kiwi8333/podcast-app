import { useEffect, useState } from "react";
import { readJson, writeJson } from "./localStore.js";

const STORAGE_KEY = "podcast-app:queue";

function readAll() {
  return readJson(STORAGE_KEY, []);
}

function writeAll(queue) {
  return writeJson(STORAGE_KEY, queue);
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
