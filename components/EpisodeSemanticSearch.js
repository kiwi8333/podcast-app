import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import styles from "./EpisodeSemanticSearch.module.css";

export default function EpisodeSemanticSearch({ episodes, onResults }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [active, setActive] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setStatus("loading");
    fetch("/api/ai/semantic-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: trimmed,
        episodes: episodes.map((e) => ({ guid: e.guid, title: e.title, description: e.description })),
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Search failed");
        return res.json();
      })
      .then((data) => {
        const byGuid = new Map(episodes.map((e) => [e.guid, e]));
        const matched = (data.matches || []).map((m) => byGuid.get(m.guid)).filter(Boolean);
        setActive(true);
        setStatus("done");
        onResults(matched);
      })
      .catch(() => setStatus("error"));
  }

  function handleClear() {
    setQuery("");
    setActive(false);
    setStatus("idle");
    onResults(null);
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <Sparkles size={14} className={styles.icon} />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search episodes by topic…"
        className={styles.input}
      />
      {active && (
        <button type="button" onClick={handleClear} className={styles.clearButton} aria-label="Clear search">
          <X size={14} />
        </button>
      )}
      <button type="submit" disabled={status === "loading"} className={styles.button}>
        {status === "loading" ? "Searching…" : "Search"}
      </button>
      {status === "error" && <p className={styles.error}>Search failed — try again.</p>}
      {status === "done" && <p className={styles.hint}>Showing episodes matching &quot;{query}&quot;.</p>}
    </form>
  );
}
