import Skeleton from "./Skeleton";
import styles from "./PodcastCard.module.css";

export default function PodcastCardSkeleton() {
  return (
    <div className={styles.card}>
      <Skeleton width={64} height={64} />
      <div className={styles.info} style={{ flex: 1 }}>
        <Skeleton width="55%" height={16} style={{ marginBottom: 8 }} />
        <Skeleton width="35%" height={12} />
      </div>
    </div>
  );
}
