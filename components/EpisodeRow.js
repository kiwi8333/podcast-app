import { Download, Check, Loader2, Play, ListPlus } from "lucide-react";
import { usePlayer } from "./Player/PlayerContext";
import { useDownloadStatus } from "@/lib/downloads";
import { useQueue } from "@/lib/queue";
import Chapters from "./Chapters";
import EpisodeSummary from "./EpisodeSummary";
import AskEpisodeChat from "./AskEpisodeChat";
import Transcript from "./Transcript";
import styles from "./EpisodeRow.module.css";

export default function EpisodeRow({ episode, podcastTitle, artwork }) {
  const { playEpisode, nowPlaying } = usePlayer();
  const isPlaying = nowPlaying?.audioUrl === episode.audioUrl;
  const [downloadStatus, download, removeDownload] = useDownloadStatus(episode.audioUrl);
  const [queue, addToQueue] = useQueue();
  const isQueued = queue.some((e) => e.audioUrl === episode.audioUrl);

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
    <div className={styles.row}>
      <div className={styles.info}>
        {episode.artwork && <img src={episode.artwork} alt="" className={styles.episodeArtwork} />}
        <div className={styles.title}>{episode.title}</div>
        <div className={styles.date}>
          {episode.pubDate ? new Date(episode.pubDate).toLocaleDateString() : ""}
          {(episode.season || episode.episodeNumber) && (
            <span className={styles.badge}>
              {episode.season ? `S${episode.season} ` : ""}
              {episode.episodeNumber ? `E${episode.episodeNumber}` : ""}
            </span>
          )}
        </div>
        {episode.description && <p className={styles.description}>{episode.description}</p>}
        <EpisodeSummary episode={episode} podcastTitle={podcastTitle} />
        <Chapters episode={episode} />
        <Transcript episode={episode} />
        <AskEpisodeChat episode={episode} />
      </div>
      <div className={styles.actions}>
        <button
          onClick={handleQueueClick}
          disabled={!episode.audioUrl || isQueued}
          title={isQueued ? "In queue" : "Add to queue"}
          className={`${styles.iconButton} ${isQueued ? styles.iconButtonDownloaded : ""}`}
        >
          {isQueued ? <Check size={18} /> : <ListPlus size={18} />}
        </button>
        <button
          onClick={handleDownloadClick}
          disabled={!episode.audioUrl || downloadStatus === "downloading"}
          title={downloadStatus === "downloaded" ? "Remove download" : "Download for offline"}
          className={`${styles.iconButton} ${
            downloadStatus === "downloaded" ? styles.iconButtonDownloaded : ""
          }`}
        >
          {downloadStatus === "downloaded" ? (
            <Check size={18} />
          ) : downloadStatus === "downloading" ? (
            <Loader2 size={18} className={styles.spin} />
          ) : (
            <Download size={18} />
          )}
        </button>
        <button
          onClick={handlePlay}
          disabled={!episode.audioUrl}
          className={`${styles.playButton} ${isPlaying ? styles.playButtonPlaying : ""}`}
        >
          <Play size={16} fill="currentColor" />
          {isPlaying ? "Playing" : "Play"}
        </button>
      </div>
    </div>
  );
}
