import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Skeleton from "@/components/Skeleton";
import { getCategory } from "@/lib/categories";
import { fetchCategoryPodcasts } from "@/lib/discover";
import styles from "../../components/TopicRow.module.css";
import podcastStyles from "../Podcast.module.css";

export default function CategoryPage() {
  const router = useRouter();
  const { slug } = router.query;
  const category = slug ? getCategory(slug) : null;

  const [podcasts, setPodcasts] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!category) return;
    setStatus("loading");
    fetchCategoryPodcasts(category, 50)
      .then((results) => {
        setPodcasts(results);
        setStatus("done");
      })
      .catch(() => setStatus("error"));
  }, [category]);

  if (!category) return null;

  return (
    <div>
      <Link href="/" className={podcastStyles.back}>
        <ArrowLeft size={14} />
        Back home
      </Link>
      <h1 style={{ fontSize: "var(--font-size-xl)", margin: "16px 0" }}>{category.label}</h1>

      {status === "loading" && (
        <div className={styles.grid}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i}>
              <Skeleton width="100%" height={140} />
              <Skeleton width="80%" height={14} style={{ marginTop: 8 }} />
            </div>
          ))}
        </div>
      )}

      {status === "error" && <p className={podcastStyles.status}>Something went wrong. Try again.</p>}

      {status === "done" && podcasts.length === 0 && (
        <p className={podcastStyles.status}>No shows found yet for this topic.</p>
      )}

      {status === "done" && podcasts.length > 0 && (
        <div className={styles.grid}>
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
