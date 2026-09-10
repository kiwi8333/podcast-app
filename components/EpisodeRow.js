import { Download, Check, Loader2, Play, ListPlus } from "lucide-react";
import { usePlayer } from "./Player/PlayerContext";
import { useDownloadStatus } from "@/lib/downloads";
import { useQueue } from "@/lib/queue";
import { formatDuration, formatEpisodeDate, formatEpisodeNumber, bannerFor } from "@/lib/episodeMeta";
import Chapters from "./Chapters";
import EpisodeSummary from "./EpisodeSummary";
import AskEpisodeChat from "./AskEpisodeChat";
import Transcript from "./Transcript";
import styles from "./EpisodeRow.module.css";

export default function EpisodeRow({ episode, podcastTitle, artwork, allowBanner = true }) {
  const { playEpisode, nowPlaying } = usePlayer();
  const isPlaying = nowPlaying?.audioUrl === episode.audioUrl;
  const [downloadStatus, download, removeDownload] = useDownloadStatus(episode.audioUrl);
  const [queue, addToQueue] = useQueue();
  const isQueued = queue.some((e) => e.audioUrl === episode.audioUrl);

  // Only art the episode owns, so a feed that repeats the show cover — or
  // sets none, which is most of them — doesn't put the same picture on every
  // card down the page.
  const banner = allowBanner ? bannerFor(episode, artwork) : null;
  const label = formatEpisodeNumber(episode.season, episode.episodeNumber);
  const date = formatEpisodeDate(episode.pubDate);
  const duration = formatDuration(episode.duration);

  function handlePlay() {
    if (!episode.audioUrl) return;
    playEpisode({
      audioUrl: episode.audioUrl,
      title: episode.title,
      podcastTitle,
      artwork,
    });
  }

  function handleQueueClick() {
    addToQueue({
      audioUrl: episode.audioUrl,
      title: episode.title,
      podcastTitle,
      artwork,
    });
  }

  function handleDownloadClick() {
    if (downloadStatus === "downloaded") {
      removeDownload();
    } else if (downloadStatus === "idle") {
      download({
        audioUrl: episode.audioUrl,
        title: episode.title,
        podcastTitle,
        artwork,
      });
    }
  }

  return (
    <article className={`${styles.card} ${isPlaying ? styles.cardPlaying : ""}`}>
      {banner && (
        <img src={banner} alt="" className={styles.banner} loading="lazy" decoding="async" />
      )}

      <div className={styles.body}>
        {label && <div className={styles.eyebrow}>{label}</div>}

        <h3 className={styles.title}>{episode.title}</h3>

        {episode.description && <p className={styles.description}>{episode.description}</p>}

        {(date || duration) && (
          <div className={styles.meta}>
            {date}
            {date && duration && <span className={styles.dot} aria-hidden="true">·</span>}
            {duration}
          </div>
        )}

        <div className={styles.actions}>
          <button
            onClick={handlePlay}
            disabled={!episode.audioUrl}
            className={`${styles.playButton} ${isPlaying ? styles.playButtonPlaying : ""}`}
          >
            <Play size={15} fill="currentColor" />
            {isPlaying ? "Playing" : "Play"}
          </button>

          <div className={styles.iconActions}>
            <button
              onClick={handleQueueClick}
              disabled={!episode.audioUrl || isQueued}
              title={isQueued ? "In queue" : "Add to queue"}
              className={`${styles.iconButton} ${isQueued ? styles.iconButtonDone : ""}`}
            >
              {isQueued ? <Check size={17} /> : <ListPlus size={17} />}
            </button>
            <button
              onClick={handleDownloadClick}
              disabled={!episode.audioUrl || downloadStatus === "downloading"}
              title={downloadStatus === "downloaded" ? "Remove download" : "Download for offline"}
              className={`${styles.iconButton} ${
                downloadStatus === "downloaded" ? styles.iconButtonDone : ""
              }`}
            >
              {downloadStatus === "downloaded" ? (
                <Check size={17} />
              ) : downloadStatus === "downloading" ? (
                <Loader2 size={17} className={styles.spin} />
              ) : (
                <Download size={17} />
              )}
            </button>
          </div>
        </div>

        {/* The expandable extras stay inside the card, below its actions, so
            an opened transcript belongs to a visible container rather than
            pushing the next episode down an undivided page. */}
        <div className={styles.extras}>
          <EpisodeSummary episode={episode} podcastTitle={podcastTitle} />
          <Chapters episode={episode} />
          <Transcript episode={episode} />
          <AskEpisodeChat episode={episode} />
        </div>
      </div>
    </article>
  );
}
