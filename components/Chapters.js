import { useEffect, useState } from "react";
import { usePlayer } from "./Player/PlayerContext";
import styles from "./Chapters.module.css";

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Chapters({ episode }) {
  const { nowPlaying, seek } = usePlayer();
  const [chapters, setChapters] = useState([]);
  const [status, setStatus] = useState("idle");
  const isCurrentEpisode = nowPlaying?.audioUrl === episode.audioUrl;

  useEffect(() => {
    if (!episode.chaptersUrl) return;

    let cancelled = false;
    // Reset to loading when chaptersUrl changes so stale content isn't shown mid-fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus("loading");
    fetch(`/api/chapters?url=${encodeURIComponent(episode.chaptersUrl)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load chapters");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setChapters(data.chapters || []);
        setStatus("done");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [episode.chaptersUrl]);

  if (!episode.chaptersUrl) return null;
  if (status === "loading" || status === "error") return null;
  if (status === "done" && chapters.length === 0) return null;

  return (
    <ul className={styles.list}>
      {chapters.map((chapter, i) => (
        <li key={i}>
          {isCurrentEpisode ? (
            <button onClick={() => seek(chapter.startTime)} className={styles.chapterButton}>
              <span className={styles.time}>{formatTime(chapter.startTime)}</span>
              <span>{chapter.title}</span>
            </button>
          ) : (
            <span className={styles.chapterStatic}>
              <span className={styles.time}>{formatTime(chapter.startTime)}</span>
              <span>{chapter.title}</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
