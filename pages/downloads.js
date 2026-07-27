import { Play } from "lucide-react";
import { usePlayer } from "@/components/Player/PlayerContext";
import { useDownloadsList } from "@/lib/downloads";
import styles from "./ListPage.module.css";

export default function Downloads() {
  const [downloads, remove] = useDownloadsList();
  const { playEpisode, nowPlaying } = usePlayer();

  if (downloads.length === 0) {
    return (
      <p className={styles.status}>
        You haven't downloaded any episodes yet. Download one from a show's episode list.
      </p>
    );
  }

  return (
    <div className={styles.list}>
      {downloads.map((ep) => {
        const isPlaying = nowPlaying?.audioUrl === ep.audioUrl;
        return (
          <div key={ep.audioUrl} className={styles.downloadRow}>
            {ep.artwork && (
              <img src={ep.artwork} alt="" width={56} height={56} className={styles.artwork} />
            )}
            <div className={styles.info}>
              <div className={styles.title}>{ep.title}</div>
              <div className={styles.subtitle}>{ep.podcastTitle}</div>
            </div>
            <button
              onClick={() => playEpisode(ep)}
              className={`${styles.playButton} ${isPlaying ? styles.playButtonPlaying : ""}`}
            >
              <Play size={16} fill="currentColor" />
              {isPlaying ? "Playing" : "Play"}
            </button>
            <button onClick={() => remove(ep.audioUrl)} className={styles.removeButton}>
              Remove
            </button>
          </div>
        );
      })}
    </div>
  );
}
