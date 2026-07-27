import PodcastCard from "@/components/PodcastCard";
import { useFavoritesList } from "@/lib/favorites";
import styles from "./ListPage.module.css";

export default function Favorites() {
  const [favorites, remove] = useFavoritesList();

  if (favorites.length === 0) {
    return (
      <p className={styles.status}>
        You haven't subscribed to any shows yet. Search for one on the Home page.
      </p>
    );
  }

  return (
    <div className={styles.list}>
      {favorites.map((podcast) => (
        <div key={podcast.feedUrl} className={styles.row}>
          <div className={styles.rowCard}>
            <PodcastCard podcast={podcast} />
          </div>
          <button onClick={() => remove(podcast.feedUrl)} className={styles.removeButton}>
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
