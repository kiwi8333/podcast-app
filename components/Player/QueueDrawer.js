import { X } from "lucide-react";
import { usePlayer } from "./PlayerContext";
import styles from "./QueueDrawer.module.css";

export default function QueueDrawer({ queue, onRemove, onClose }) {
  const { playEpisode } = usePlayer();

  function playNow(episode) {
    onRemove(episode.audioUrl);
    playEpisode(episode);
    onClose();
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.panel}>
        <div className={styles.header}>
          <span>Up next</span>
          <button onClick={onClose} className={styles.closeButton} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {queue.length === 0 ? (
          <p className={styles.empty}>Nothing queued. Add episodes from any episode list.</p>
        ) : (
          <div className={styles.list}>
            {queue.map((episode) => (
              <div key={episode.audioUrl} className={styles.item}>
                {episode.artwork && (
                  <img src={episode.artwork} alt="" className={styles.artwork} />
                )}
                <div className={styles.info}>
                  <div className={styles.title}>{episode.title}</div>
                  <div className={styles.podcastTitle}>{episode.podcastTitle}</div>
                </div>
                <button onClick={() => playNow(episode)} className={styles.playButton}>
                  Play
                </button>
                <button
                  onClick={() => onRemove(episode.audioUrl)}
                  className={styles.removeButton}
                  aria-label="Remove from queue"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
