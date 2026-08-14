import { useState } from "react";
import { Sparkles } from "lucide-react";
import styles from "./EpisodeSummary.module.css";

export default function EpisodeSummary({ episode, podcastTitle }) {
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [summary, setSummary] = useState(null);

  if (!episode.description || episode.description.trim().length < 20) return null;

  function handleClick() {
    setStatus("loading");
    fetch("/api/ai/summarize-episode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: episode.title,
        description: episode.description,
        podcastTitle,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to summarize");
        return res.json();
      })
      .then((data) => {
        if (!data.summary) {
          setStatus("error");
          return;
        }
        setSummary(data.summary);
        setStatus("done");
      })
      .catch(() => setStatus("error"));
  }

  if (status === "done" && summary) {
    return <p className={styles.summary}>{summary}</p>;
  }

  return (
    <button onClick={handleClick} disabled={status === "loading"} className={styles.button}>
      <Sparkles size={13} />
      {status === "loading" ? "Summarizing…" : status === "error" ? "Couldn't summarize — retry" : "Summarize"}
    </button>
  );
}
