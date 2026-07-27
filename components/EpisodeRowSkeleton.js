import Skeleton from "./Skeleton";
import styles from "./EpisodeRow.module.css";

export default function EpisodeRowSkeleton() {
  return (
    <div className={styles.row}>
      <div className={styles.info} style={{ flex: 1 }}>
        <Skeleton width="70%" height={16} style={{ marginBottom: 8 }} />
        <Skeleton width="30%" height={12} style={{ marginBottom: 10 }} />
        <Skeleton width="100%" height={12} style={{ marginBottom: 6 }} />
        <Skeleton width="90%" height={12} />
      </div>
    </div>
  );
}
