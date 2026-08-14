import { useState } from "react";
import { Sparkles } from "lucide-react";
import { getNewEpisodes } from "@/lib/subscriptions";
import styles from "./CatchMeUpDigest.module.css";

export default function CatchMeUpDigest({ favorites }) {
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [digest, setDigest] = useState(null);

  const candidates = favorites.filter((f) => f.hasNewEpisode);
  if (candidates.length === 0) return null;

  async function handleClick() {
    setStatus("loading");
    try {
      const results = await Promise.all(
        candidates.map(async (podcast) => {
          const res = await fetch(`/api/feed?url=${encodeURIComponent(podcast.feedUrl)}`);
          if (!res.ok) return [];
          const data = await res.json();
          return getNewEpisodes(podcast.feedUrl, data.episodes || []).map((ep) => ({
            podcastTitle: podcast.title,
            title: ep.title,
            pubDate: ep.pubDate,
            description: ep.description,
          }));
        })
      );

      const episodes = results.flat();
      if (episodes.length === 0) {
        setStatus("error");
        return;
      }

      const res = await fetch("/api/ai/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodes }),
      });
      if (!res.ok) throw new Error("Failed to build digest");
      const data = await res.json();
      if (!data.digest) {
        setStatus("error");
        return;
      }
      setDigest(data.digest);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done" && digest) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <Sparkles size={14} />
          Catch me up
        </div>
        <p className={styles.text}>{digest}</p>
      </div>
    );
  }

  return (
    <button onClick={handleClick} disabled={status === "loading"} className={styles.button}>
      <Sparkles size={14} />
      {status === "loading"
        ? "Catching you up…"
        : status === "error"
          ? "Couldn't build a digest — retry"
          : `Catch me up (${candidates.length} show${candidates.length > 1 ? "s" : ""} with new episodes)`}
    </button>
  );
}
