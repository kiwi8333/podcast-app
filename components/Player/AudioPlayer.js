import { usePlayer } from "./PlayerContext";
import styles from "./AudioPlayer.module.css";

export default function AudioPlayer() {
  const { nowPlaying } = usePlayer();

  if (!nowPlaying) {
    return null;
  }

  return (
    <div className={styles.bar}>
      {nowPlaying.artwork && (
        <img src={nowPlaying.artwork} alt="" className={styles.artwork} />
      )}
      <div className={styles.info}>
        <div className={styles.title}>{nowPlaying.title}</div>
        <div className={styles.podcastTitle}>{nowPlaying.podcastTitle}</div>
      </div>
      <audio
        key={nowPlaying.src}
        src={nowPlaying.src}
        controls
        autoPlay
        className={styles.audio}
      />
    </div>
  );
}
