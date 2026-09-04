import { Play, Pause, RotateCcw, RotateCw } from "lucide-react";
import { usePlayer, usePlayerTime } from "./PlayerContext";
import SleepTimerButton from "./SleepTimerButton";
import QueueButton from "./QueueButton";
import styles from "./AudioPlayer.module.css";

const SPEEDS = [0.5, 1, 1.25, 1.5, 2];

// Podcast episodes routinely run past an hour, where a bare minutes:seconds
// clock reads "90:00" instead of "1:30:00". Hours appear only when there are
// any, so short episodes keep the compact form.
function formatTime(seconds) {
  if (!seconds || !Number.isFinite(seconds)) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export default function AudioPlayer() {
  const {
    nowPlaying,
    isPlaying,
    playbackRate,
    togglePlayPause,
    seek,
    skip,
    setPlaybackRate,
  } = usePlayer();
  // Subscribes only this component to the playback tick.
  const { currentTime, duration } = usePlayerTime();

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
          <SleepTimerButton />
          <QueueButton />
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
