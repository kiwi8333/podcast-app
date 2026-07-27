import { useState } from "react";
import SearchBar from "@/components/SearchBar";
import PodcastCard from "@/components/PodcastCard";
import PodcastCardSkeleton from "@/components/PodcastCardSkeleton";
import ContinueListeningRow from "@/components/ContinueListeningRow";
import TopicRow from "@/components/TopicRow";
import { searchPodcasts } from "@/lib/itunes";
import { CATEGORIES } from "@/lib/categories";
import styles from "./Home.module.css";

export default function Home() {
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("idle");

  async function handleSearch(term) {
    setStatus("loading");
    try {
      const podcasts = await searchPodcasts(term);
      setResults(podcasts);
      setStatus("done");
    } catch (err) {
      setStatus("error");
    }
  }

  return (
    <div>
      <SearchBar onSearch={handleSearch} />

      {status === "idle" && (
        <>
          <ContinueListeningRow />
          {CATEGORIES.map((category) => (
            <TopicRow key={category.slug} category={category} />
          ))}
        </>
      )}

      <div className={styles.results}>
        {status === "loading" &&
          Array.from({ length: 4 }).map((_, i) => <PodcastCardSkeleton key={i} />)}
        {status === "error" && <p className={styles.status}>Something went wrong. Try again.</p>}
        {status === "done" && results.length === 0 && (
          <p className={styles.status}>No shows found.</p>
        )}
        {results.map((podcast) => (
          <PodcastCard key={podcast.id} podcast={podcast} />
        ))}
      </div>
    </div>
  );
}
