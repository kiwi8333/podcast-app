import { usePlayer } from "@/components/Player/PlayerContext";
import { useDownloadsList } from "@/lib/downloads";

export default function Downloads() {
  const [downloads, remove] = useDownloadsList();
  const { playEpisode, nowPlaying } = usePlayer();

  if (downloads.length === 0) {
    return <p>You haven't downloaded any episodes yet. Download one from a show's episode list.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {downloads.map((ep) => {
        const isPlaying = nowPlaying?.audioUrl === ep.audioUrl;
        return (
          <div
            key={ep.audioUrl}
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              padding: 10,
              border: "1px solid #eee",
              borderRadius: 8,
            }}
          >
            {ep.artwork && (
              <img
                src={ep.artwork}
                alt=""
                width={56}
                height={56}
                style={{ borderRadius: 6, objectFit: "cover" }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{ep.title}</div>
              <div style={{ fontSize: 13, color: "#888" }}>{ep.podcastTitle}</div>
            </div>
            <button
              onClick={() => playEpisode(ep)}
              style={{
                height: 36,
                padding: "0 14px",
                borderRadius: 6,
                border: "none",
                background: isPlaying ? "#555" : "#1a1a1a",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              {isPlaying ? "Playing" : "Play"}
            </button>
            <button
              onClick={() => remove(ep.audioUrl)}
              style={{
                height: 36,
                padding: "0 12px",
                borderRadius: 6,
                border: "1px solid #ccc",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Remove
            </button>
          </div>
        );
      })}
    </div>
  );
}
