import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowLeft, Star } from "lucide-react";
import EpisodeList from "@/components/EpisodeList";
import EpisodeRowSkeleton from "@/components/EpisodeRowSkeleton";
import Skeleton from "@/components/Skeleton";
import { useFavorite } from "@/lib/favorites";
import styles from "../Podcast.module.css";

export default function PodcastPage() {
  const router = useRouter();
  const { feedUrl } = router.query;

  const [feed, setFeed] = useState(null);
  const [status, setStatus] = useState("loading");
  const [favorited, toggleFavorited] = useFavorite({
    feedUrl: feedUrl ? decodeURIComponent(feedUrl) : "",
    title: feed?.title,
    artist: feed?.author,
    artwork: feed?.image,
  });

  useEffect(() => {
    if (!feedUrl) return;

    setStatus("loading");
    fetch(`/api/feed?url=${encodeURIComponent(decodeURIComponent(feedUrl))}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load feed");
        return res.json();
      })
      .then((data) => {
        setFeed(data);
        setStatus("done");
      })
      .catch(() => setStatus("error"));
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
    return <p className={styles.status}>Couldn't load this podcast. Try another one.</p>;
  if (!feed) return null;

  return (
    <div>
      <Link href="/" className={styles.back}>
        <ArrowLeft size={14} />
        Back to search
      </Link>
      <div className={styles.header}>
        {feed.image && (
          <img src={feed.image} alt="" width={80} height={80} className={styles.artwork} />
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
      <EpisodeList episodes={feed.episodes} podcastTitle={feed.title} artwork={feed.image} />
    </div>
  );
}
