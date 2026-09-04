import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { usePlayer, usePlayerTime } from "./Player/PlayerContext";
import { pickTranscript, isTimedTranscriptType, parseTimedTranscript } from "@/lib/transcripts";
import styles from "./Transcript.module.css";

export default function Transcript({ episode }) {
  const { nowPlaying, seek } = usePlayer();
  const { currentTime } = usePlayerTime();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [segments, setSegments] = useState(null);
  const [plainText, setPlainText] = useState(null);
  const activeRef = useRef(null);

  const transcript = episode.transcripts?.length
    ? pickTranscript(episode.transcripts, { preferTimed: true })
    : null;
  const isTimed = transcript ? isTimedTranscriptType(transcript.type) : false;
  const isCurrentEpisode = nowPlaying?.audioUrl === episode.audioUrl;

  const activeIndex =
    isCurrentEpisode && segments
      ? segments.findIndex((seg) => currentTime >= seg.start && currentTime < seg.end)
      : -1;

  useEffect(() => {
    if (activeIndex >= 0) {
      activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeIndex]);

  if (!transcript) return null;

  function handleOpen() {
    setOpen(true);
    if (status !== "idle") return;

    setStatus("loading");
    fetch(`/api/transcript?url=${encodeURIComponent(transcript.url)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load transcript");
        return res.json();
      })
      .then((data) => {
        if (isTimed) {
          setSegments(parseTimedTranscript(data.text));
        } else {
          setPlainText(data.text);
        }
        setStatus("done");
      })
      .catch(() => setStatus("error"));
  }

  if (!open) {
    return (
      <button onClick={handleOpen} className={styles.openButton}>
        <FileText size={13} />
        View transcript
      </button>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span>Transcript</span>
        <button onClick={() => setOpen(false)} className={styles.closeButton}>
          Hide
        </button>
      </div>

      {status === "loading" && <p className={styles.hint}>Loading transcript…</p>}
      {status === "error" && <p className={styles.hint}>Couldn&apos;t load the transcript.</p>}

      {status === "done" && segments && (
        <div className={styles.segments}>
          {segments.length === 0 && <p className={styles.hint}>Transcript had no readable text.</p>}
          {segments.map((seg, i) =>
            isCurrentEpisode ? (
              <button
                key={i}
                ref={i === activeIndex ? activeRef : null}
                onClick={() => seek(seg.start)}
                className={`${styles.segment} ${i === activeIndex ? styles.segmentActive : ""}`}
              >
                {seg.text}
              </button>
            ) : (
              <span key={i} className={styles.segmentStatic}>
                {seg.text}{" "}
              </span>
            )
          )}
        </div>
      )}

      {status === "done" && plainText && <p className={styles.plainText}>{plainText}</p>}
    </div>
  );
}
