import { usePlayer } from "./Player/PlayerContext";
import { useDownloadStatus } from "@/lib/downloads";

export default function EpisodeRow({ episode, podcastTitle, artwork }) {
  const { playEpisode, nowPlaying } = usePlayer();
  const isPlaying = nowPlaying?.audioUrl === episode.audioUrl;
  const [downloadStatus, download, removeDownload] = useDownloadStatus(episode.audioUrl);

  function handlePlay() {
    if (!episode.audioUrl) return;
    playEpisode({
      audioUrl: episode.audioUrl,
      title: episode.title,
      podcastTitle,
      artwork,
    });
  }

  function handleDownloadClick() {
    if (downloadStatus === "downloaded") {
      removeDownload();
    } else if (downloadStatus === "idle") {
      download({
        audioUrl: episode.audioUrl,
        title: episode.title,
        podcastTitle,
        artwork,
      });
    }
  }

  return (
    <div
      style={{
        padding: "12px 0",
        borderBottom: "1px solid #eee",
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{episode.title}</div>
        <div style={{ fontSize: 13, color: "#888" }}>
          {episode.pubDate ? new Date(episode.pubDate).toLocaleDateString() : ""}
        </div>
        {episode.description && (
          <p
            style={{
              fontSize: 14,
              color: "#555",
              margin: "6px 0 0",
              maxWidth: 600,
            }}
          >
            {episode.description}
          </p>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0, height: 36 }}>
        <button
          onClick={handleDownloadClick}
          disabled={!episode.audioUrl || downloadStatus === "downloading"}
          title={downloadStatus === "downloaded" ? "Remove download" : "Download for offline"}
          style={{
            height: 36,
            width: 36,
            borderRadius: 6,
            border: "1px solid #ccc",
            background: downloadStatus === "downloaded" ? "#e8f5e9" : "#fff",
            cursor: episode.audioUrl ? "pointer" : "not-allowed",
            fontSize: 16,
          }}
        >
          {downloadStatus === "downloaded" ? "✓" : downloadStatus === "downloading" ? "…" : "⬇"}
        </button>
        <button
          onClick={handlePlay}
          disabled={!episode.audioUrl}
          style={{
            height: 36,
            padding: "0 14px",
            borderRadius: 6,
            border: "none",
            background: isPlaying ? "#555" : "#1a1a1a",
            color: "#fff",
            cursor: episode.audioUrl ? "pointer" : "not-allowed",
          }}
        >
          {isPlaying ? "Playing" : "Play"}
        </button>
      </div>
    </div>
  );
}
