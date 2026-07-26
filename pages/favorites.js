import PodcastCard from "@/components/PodcastCard";
import { useFavoritesList } from "@/lib/favorites";

export default function Favorites() {
  const [favorites, remove] = useFavoritesList();

  if (favorites.length === 0) {
    return <p>You haven't subscribed to any shows yet. Search for one on the Home page.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {favorites.map((podcast) => (
        <div key={podcast.feedUrl} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <PodcastCard podcast={podcast} />
          </div>
          <button
            onClick={() => remove(podcast.feedUrl)}
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
      ))}
    </div>
  );
}
