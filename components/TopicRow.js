import { useEffect, useState } from "react";
import Link from "next/link";
import Skeleton from "./Skeleton";
import { fetchCategoryPodcasts } from "@/lib/discover";
import styles from "./TopicRow.module.css";

export default function TopicRow({ category }) {
  const [podcasts, setPodcasts] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchCategoryPodcasts(category)
      .then((results) => {
        if (cancelled) return;
        setPodcasts(results);
        setStatus("done");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [category]);

  return (
    <div className={styles.section}>
      <div className={styles.headingRow}>
        <h2 className={styles.heading}>{category.label}</h2>
        <Link href={`/category/${category.slug}`} className={styles.seeAll}>
          See all
        </Link>
      </div>

      {status === "loading" && (
        <div className={styles.scroller}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.tile}>
              <Skeleton width={140} height={140} />
              <Skeleton width="80%" height={14} style={{ marginTop: 8 }} />
            </div>
          ))}
        </div>
      )}

      {status === "done" && podcasts.length === 0 && (
        <p className={styles.empty}>No shows found yet for this topic.</p>
      )}

      {status === "done" && podcasts.length > 0 && (
        <div className={styles.scroller}>
          {podcasts.map((podcast) => (
            <Link
              key={podcast.id}
              href={`/podcast/${encodeURIComponent(podcast.feedUrl)}`}
              className={styles.tile}
            >
              {podcast.artwork && (
                <img src={podcast.artwork} alt="" className={styles.artwork} />
              )}
              <div className={styles.title}>{podcast.title}</div>
              <div className={styles.artist}>{podcast.artist}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
