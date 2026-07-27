import Link from "next/link";
import styles from "./PodcastCard.module.css";

export default function PodcastCard({ podcast }) {
  return (
    <Link href={`/podcast/${encodeURIComponent(podcast.feedUrl)}`} className={styles.card}>
      {podcast.artwork && (
        <img src={podcast.artwork} alt="" width={64} height={64} className={styles.artwork} />
      )}
      <div className={styles.info}>
        <div className={styles.title}>{podcast.title}</div>
        <div className={styles.artist}>{podcast.artist}</div>
      </div>
    </Link>
  );
}
