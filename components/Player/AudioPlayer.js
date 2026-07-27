import { Play, Pause, RotateCcw, RotateCw } from "lucide-react";
import { usePlayer } from "./PlayerContext";
import styles from "./AudioPlayer.module.css";

const SPEEDS = [0.5, 1, 1.25, 1.5, 2];

function formatTime(seconds) {
  if (!seconds || !Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AudioPlayer() {
  const {
    nowPlaying,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    togglePlayPause,
    seek,
    skip,
    setPlaybackRate,
  } = usePlayer();

  if (!nowPlaying) {
    return null;
  }

  function handleSpeedClick() {
    const nextIndex = (SPEEDS.indexOf(playbackRate) + 1) % SPEEDS.length;
    setPlaybackRate(SPEEDS[nextIndex]);
  }

  return (
    <div className={styles.bar}>
      <div className={styles.inner}>
        <div className={styles.topRow}>
          {nowPlaying.artwork && (
            <img src={nowPlaying.artwork} alt="" className={styles.artwork} />
          )}
          <div className={styles.info}>
            <div className={styles.title}>{nowPlaying.title}</div>
            <div className={styles.podcastTitle}>{nowPlaying.podcastTitle}</div>
          </div>
          <button onClick={handleSpeedClick} className={styles.speedButton}>
            {playbackRate}x
          </button>
        </div>

        <div className={styles.controlsRow}>
          <button onClick={() => skip(-15)} className={styles.iconButton} title="Back 15 seconds">
            <RotateCcw size={20} />
            <span className={styles.skipBadge}>15</span>
          </button>
          <button
            onClick={togglePlayPause}
            className={styles.playButton}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          </button>
          <button onClick={() => skip(15)} className={styles.iconButton} title="Forward 15 seconds">
            <RotateCw size={20} />
            <span className={styles.skipBadge}>15</span>
          </button>
          <span className={styles.time}>{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={(e) => seek(Number(e.target.value))}
            className={styles.scrubber}
          />
          <span className={styles.time}>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
