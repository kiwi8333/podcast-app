import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
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
  // Lazy-init to "loading" when chaptersUrl is present, so there's no flash
  // of the "generate from transcript" fallback before the fetch effect runs.
  const [status, setStatus] = useState(() => (episode.chaptersUrl ? "loading" : "idle"));
  const [generated, setGenerated] = useState(false);
  const isCurrentEpisode = nowPlaying?.audioUrl === episode.audioUrl;

  // Only VTT/SRT carry real per-line timing for the generate-chapters route.
  const timedTranscript = episode.transcripts?.find((t) => /vtt|srt/i.test(t.type || ""));

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
        setGenerated(false);
        setStatus("done");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [episode.chaptersUrl]);

  function handleGenerate() {
    setStatus("loading");
    fetch("/api/ai/generate-chapters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcriptUrl: timedTranscript.url,
        transcriptType: timedTranscript.type,
        title: episode.title,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to generate chapters");
        return res.json();
      })
      .then((data) => {
        setChapters(data.chapters || []);
        setGenerated(true);
        setStatus(data.chapters?.length ? "done" : "error");
      })
      .catch(() => setStatus("error"));
  }

  if (!episode.chaptersUrl && !timedTranscript) return null;
  if (status === "loading") return null;

  if (chapters.length === 0) {
    if (status === "error" || !timedTranscript) return null;
    return (
      <button onClick={handleGenerate} className={styles.generateButton}>
        <Sparkles size={13} />
        Generate chapters from transcript
      </button>
    );
  }

  return (
    <div>
      {generated && <div className={styles.generatedLabel}>AI-generated chapters</div>}
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
    </div>
  );
}
