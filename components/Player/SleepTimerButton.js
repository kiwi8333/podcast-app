import { useState } from "react";
import { Moon } from "lucide-react";
import { usePlayer } from "./PlayerContext";
import styles from "./SleepTimerButton.module.css";

const PRESETS = [15, 30, 45, 60];

export default function SleepTimerButton() {
  const { sleepMinutesRemaining, sleepMode, setSleepTimer, setSleepAtEndOfEpisode, cancelSleepTimer } =
    usePlayer();
  const [open, setOpen] = useState(false);

  function choose(action) {
    action();
    setOpen(false);
  }

  return (
    <div className={styles.wrapper}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`${styles.button} ${sleepMode !== "off" ? styles.buttonActive : ""}`}
        title="Sleep timer"
        aria-label="Sleep timer"
      >
        <Moon size={16} />
        {sleepMode === "countdown" && <span className={styles.label}>{sleepMinutesRemaining}m</span>}
      </button>

      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} />
          <div className={styles.menu}>
            {PRESETS.map((minutes) => (
              <button key={minutes} onClick={() => choose(() => setSleepTimer(minutes))} className={styles.menuItem}>
                {minutes} min
              </button>
            ))}
            <button onClick={() => choose(setSleepAtEndOfEpisode)} className={styles.menuItem}>
              End of episode
            </button>
            {sleepMode !== "off" && (
              <button onClick={() => choose(cancelSleepTimer)} className={styles.menuItem}>
                Off
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
