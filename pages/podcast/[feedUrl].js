import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import EpisodeList from "@/components/EpisodeList";
import { useFavorite } from "@/lib/favorites";

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

  if (status === "loading") return <p>Loading episodes...</p>;
  if (status === "error") return <p>Couldn't load this podcast. Try another one.</p>;
  if (!feed) return null;

  return (
    <div>
      <Link href="/" style={{ color: "#666", fontSize: 14 }}>
        &larr; Back to search
      </Link>
      <div style={{ display: "flex", gap: 16, alignItems: "center", margin: "16px 0" }}>
        {feed.image && (
          <img
            src={feed.image}
            alt=""
            width={80}
            height={80}
            style={{ borderRadius: 8, objectFit: "cover" }}
          />
        )}
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>{feed.title}</h1>
          <p style={{ color: "#666", margin: "4px 0 0", fontSize: 14 }}>
            {feed.episodes.length} episodes
          </p>
        </div>
        <button
          onClick={toggleFavorited}
          style={{
            height: 36,
            padding: "0 14px",
            borderRadius: 6,
            border: favorited ? "none" : "1px solid #ccc",
            background: favorited ? "#1a1a1a" : "#fff",
            color: favorited ? "#fff" : "#1a1a1a",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {favorited ? "★ Subscribed" : "☆ Subscribe"}
        </button>
      </div>
      <EpisodeList episodes={feed.episodes} podcastTitle={feed.title} artwork={feed.image} />
    </div>
  );
}
