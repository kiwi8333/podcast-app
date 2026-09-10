import { useState } from "react";
import { Play, Pause, Radio } from "lucide-react";
import { usePlayer } from "./Player/PlayerContext";
import styles from "./StationRow.module.css";

export default function StationRow({ station }) {
  const { nowPlaying, isPlaying, playStation, togglePlayPause } = usePlayer();
  // Station logos are hotlinked from whatever the directory holds, so a
  // meaningful share of them 404. Falling back to the icon keeps the row
  // aligned instead of leaving a broken-image box in the list.
  const [logoFailed, setLogoFailed] = useState(false);

  const isCurrent = nowPlaying?.audioUrl === station.streamUrl;
  const isThisPlaying = isCurrent && isPlaying;

  function handleToggle() {
    // Re-tapping the station that is already loaded pauses it rather than
    // reopening the same stream, which would drop and re-buffer it.
    if (isCurrent) togglePlayPause();
    else playStation(station);
  }

  const meta = [
    station.codec,
    station.bitrate ? `${station.bitrate} kbps` : null,
    station.language,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={`${styles.row} ${isCurrent ? styles.rowCurrent : ""}`}>
      <div className={styles.logoWrap}>
        {station.logo && !logoFailed ? (
          <img
            src={station.logo}
            alt=""
            className={styles.logo}
            loading="lazy"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <Radio size={20} className={styles.logoFallback} aria-hidden="true" />
        )}
      </div>

      <div className={styles.info}>
        <div className={styles.name}>{station.name}</div>
        <div className={styles.meta}>{meta || "Live stream"}</div>
      </div>

      <button
        type="button"
        onClick={handleToggle}
        className={styles.playButton}
        aria-label={isThisPlaying ? `Pause ${station.name}` : `Play ${station.name}`}
      >
        {isThisPlaying ? (
          <Pause size={18} fill="currentColor" />
        ) : (
          <Play size={18} fill="currentColor" />
        )}
      </button>
    </div>
  );
}
