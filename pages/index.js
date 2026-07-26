import { useState } from "react";
import SearchBar from "@/components/SearchBar";
import PodcastCard from "@/components/PodcastCard";
import { searchPodcasts } from "@/lib/itunes";

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

      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        {status === "loading" && <p>Searching...</p>}
        {status === "error" && <p>Something went wrong. Try again.</p>}
        {status === "done" && results.length === 0 && <p>No shows found.</p>}
        {results.map((podcast) => (
          <PodcastCard key={podcast.id} podcast={podcast} />
        ))}
      </div>
    </div>
  );
}
