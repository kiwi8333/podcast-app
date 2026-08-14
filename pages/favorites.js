import PodcastCard from "@/components/PodcastCard";
import OpmlControls from "@/components/OpmlControls";
import CatchMeUpDigest from "@/components/CatchMeUpDigest";
import { useFavoritesList } from "@/lib/favorites";
import styles from "./ListPage.module.css";

export default function Favorites() {
  const [favorites, remove, refresh] = useFavoritesList();

  return (
    <div>
      <CatchMeUpDigest favorites={favorites} />
      <OpmlControls favorites={favorites} onImport={refresh} />

      {favorites.length === 0 ? (
        <p className={styles.status}>
          You haven&apos;t subscribed to any shows yet. Search for one on the Home page.
        </p>
      ) : (
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
      )}
    </div>
  );
}
