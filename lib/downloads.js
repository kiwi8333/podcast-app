import { openDB } from "idb";
import { useEffect, useState } from "react";

const DB_NAME = "podcast-app-downloads";
const STORE_NAME = "episodes";

function getDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME, { keyPath: "audioUrl" });
    },
  });
}

export async function getDownload(audioUrl) {
  const db = await getDb();
  return db.get(STORE_NAME, audioUrl);
}

export async function getAllDownloads() {
  const db = await getDb();
  return db.getAll(STORE_NAME);
}

export async function saveDownload(episode) {
  const res = await fetch(`/api/audio?url=${encodeURIComponent(episode.audioUrl)}`);
  if (!res.ok) throw new Error("Could not download this episode");
  const blob = await res.blob();

  const db = await getDb();
  await db.put(STORE_NAME, {
    audioUrl: episode.audioUrl,
    title: episode.title,
    podcastTitle: episode.podcastTitle,
    artwork: episode.artwork,
    blob,
    downloadedAt: Date.now(),
  });
}

export async function deleteDownload(audioUrl) {
  const db = await getDb();
  await db.delete(STORE_NAME, audioUrl);
}

export function useDownloadStatus(audioUrl) {
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    let cancelled = false;
    if (!audioUrl) return;
    getDownload(audioUrl).then((record) => {
      if (!cancelled) setStatus(record ? "downloaded" : "idle");
    });
    return () => {
      cancelled = true;
    };
  }, [audioUrl]);

  async function download(episode) {
    setStatus("downloading");
    try {
      await saveDownload(episode);
      setStatus("downloaded");
    } catch {
      setStatus("idle");
    }
  }

  async function remove() {
    await deleteDownload(audioUrl);
    setStatus("idle");
  }

  return [status, download, remove];
}

export function useDownloadsList() {
  const [downloads, setDownloads] = useState([]);

  function refresh() {
    getAllDownloads().then(setDownloads);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function remove(audioUrl) {
    await deleteDownload(audioUrl);
    refresh();
  }

  return [downloads, remove];
}
