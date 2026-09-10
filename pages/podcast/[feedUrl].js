import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Star } from "lucide-react";
import EpisodeList from "@/components/EpisodeList";
import EpisodeRowSkeleton from "@/components/EpisodeRowSkeleton";
import EpisodeSemanticSearch from "@/components/EpisodeSemanticSearch";
import Skeleton from "@/components/Skeleton";
import { useFavorite } from "@/lib/favorites";
import { markSeen } from "@/lib/subscriptions";
import { getCachedFeed, setCachedFeed } from "@/lib/feedCache";
import styles from "../Podcast.module.css";

export default function PodcastPage() {
  const router = useRouter();
  const { feedUrl } = router.query;

  const [feed, setFeed] = useState(null);
  const [status, setStatus] = useState("loading");
  const [searchResults, setSearchResults] = useState(null);
  const [favorited, toggleFavorited] = useFavorite({
    feedUrl: feedUrl ? decodeURIComponent(feedUrl) : "",
    title: feed?.title,
    artist: feed?.author,
    artwork: feed?.image,
  });

  useEffect(() => {
    if (!feedUrl) return;
    const url = decodeURIComponent(feedUrl);
    let cancelled = false;

    // Reset to loading when feedUrl changes so stale content isn't shown mid-fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus("loading");
    setSearchResults(null);

    // Paint whatever was cached, then revalidate over the network. Opening a
    // show used to mean staring at skeletons for a full feed fetch and parse
    // every single time, even for a feed read a minute ago.
    async function load() {
      const cached = await getCachedFeed(url);
      if (cancelled) return;
      if (cached) {
        setFeed(cached);
        setStatus("done");
      }

      try {
        const res = await fetch(`/api/feed?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error("Failed to load feed");
        const data = await res.json();
        if (cancelled) return;
        setFeed(data);
        setStatus("done");
        markSeen(url, data.episodes?.[0]?.guid);
        setCachedFeed(url, data);
      } catch {
        // Offline with something cached is a working screen, not an error —
        // only report failure when there is nothing at all to show.
        if (!cancelled && !cached) setStatus("error");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [feedUrl]);

  if (status === "loading") {
    return (
      <div>
        <div className={styles.header}>
          <Skeleton width={80} height={80} />
          <div className={styles.meta}>
            <Skeleton width="50%" height={22} style={{ marginBottom: 8 }} />
            <Skeleton width="25%" height={14} />
          </div>
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <EpisodeRowSkeleton key={i} />
        ))}
      </div>
    );
  }
  if (status === "error")
    return <p className={styles.status}>Couldn&apos;t load this podcast. Try another one.</p>;
  if (!feed) return null;

  return (
    <div>
      <div className={styles.header}>
        {feed.image && (
          <img src={feed.image} alt="" width={132} height={132} className={styles.artwork} />
        )}
        <div className={styles.meta}>
          <h1 className={styles.title}>{feed.title}</h1>
          <p className={styles.episodeCount}>{feed.episodes.length} episodes</p>
        </div>
        <button
          onClick={toggleFavorited}
          className={`${styles.subscribeButton} ${
            favorited ? styles.subscribeButtonActive : ""
          }`}
        >
          <Star size={16} fill={favorited ? "currentColor" : "none"} />
          {favorited ? "Subscribed" : "Subscribe"}
        </button>
      </div>
      {feed.episodes.length > 1 && (
        <EpisodeSemanticSearch episodes={feed.episodes} onResults={setSearchResults} />
      )}
      <EpisodeList
        episodes={searchResults || feed.episodes}
        podcastTitle={feed.title}
        artwork={feed.image}
      />
    </div>
  );
}
