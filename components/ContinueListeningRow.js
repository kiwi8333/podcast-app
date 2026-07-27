import { usePlayer } from "./Player/PlayerContext";
import { useContinueListening } from "@/lib/playbackProgress";
import styles from "./ContinueListeningRow.module.css";

export default function ContinueListeningRow() {
  const episodes = useContinueListening();
  const { playEpisode } = usePlayer();

  if (episodes.length === 0) return null;

  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Continue Listening</h2>
      <div className={styles.scroller}>
        {episodes.map((ep) => (
          <button
            key={ep.audioUrl}
            className={styles.card}
            onClick={() =>
              playEpisode({
                audioUrl: ep.audioUrl,
                title: ep.title,
                podcastTitle: ep.podcastTitle,
                artwork: ep.artwork,
              })
            }
          >
            {ep.artwork && <img src={ep.artwork} alt="" className={styles.artwork} />}
            <div className={styles.title}>{ep.title}</div>
            <div className={styles.podcastTitle}>{ep.podcastTitle}</div>
            <div className={styles.progressTrack}>
              <div
                className={styles.progressFill}
                style={{ width: `${Math.min(100, (ep.position / ep.duration) * 100)}%` }}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
