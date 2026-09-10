import Link from "next/link";
import { ChevronRight } from "lucide-react";
import styles from "./PodcastCard.module.css";

export default function PodcastCard({ podcast }) {
  return (
    <Link href={`/podcast/${encodeURIComponent(podcast.feedUrl)}`} className={styles.card}>
      {podcast.artwork && (
        <img src={podcast.artwork} alt="" width={56} height={56} className={styles.artwork} />
      )}
      <div className={styles.info}>
        <div className={styles.title}>
          {podcast.title}
          {podcast.hasNewEpisode && <span className={styles.newBadge} title="New episode" />}
        </div>
        <div className={styles.artist}>{podcast.artist}</div>
      </div>
      {/* A disclosure chevron: this row opens another screen, and iOS says so
          rather than leaving the row looking like a static card. */}
      <ChevronRight size={16} className={styles.chevron} aria-hidden="true" />
    </Link>
  );
}
