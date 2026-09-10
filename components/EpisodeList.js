import EpisodeRow from "./EpisodeRow";
import { bannersWorthShowing } from "@/lib/episodeMeta";
import styles from "./EpisodeList.module.css";

export default function EpisodeList({ episodes, podcastTitle, artwork }) {
  if (!episodes || episodes.length === 0) {
    return <p className={styles.empty}>No episodes found in this feed.</p>;
  }

  // Decided for the whole feed, not per card: a single episode cannot tell
  // whether its artwork is unique to it or the same image every other episode
  // is carrying.
  const allowBanners = bannersWorthShowing(episodes, artwork);

  return (
    <div className={styles.list}>
      {episodes.map((episode) => (
        <EpisodeRow
          key={episode.guid || episode.audioUrl}
          episode={episode}
          podcastTitle={podcastTitle}
          artwork={artwork}
          allowBanner={allowBanners}
        />
      ))}
    </div>
  );
}
