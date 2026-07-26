import Link from "next/link";

export default function PodcastCard({ podcast }) {
  return (
    <Link
      href={`/podcast/${encodeURIComponent(podcast.feedUrl)}`}
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: 10,
        border: "1px solid #eee",
        borderRadius: 8,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      {podcast.artwork && (
        <img
          src={podcast.artwork}
          alt=""
          width={64}
          height={64}
          style={{ borderRadius: 6, objectFit: "cover" }}
        />
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{podcast.title}</div>
        <div style={{ fontSize: 14, color: "#666" }}>{podcast.artist}</div>
      </div>
    </Link>
  );
}
