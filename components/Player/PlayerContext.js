import { createContext, useContext, useEffect, useRef, useState } from "react";
import { getDownload } from "@/lib/downloads";
import { getProgress, setProgress, clearProgress } from "@/lib/playbackProgress";

const PlayerContext = createContext(null);
const PROGRESS_SAVE_INTERVAL = 5;

export function PlayerProvider({ children }) {
  const audioRef = useRef(null);
  const objectUrlRef = useRef(null);
  const nowPlayingRef = useRef(null);
  const lastSavedRef = useRef(0);

  const [nowPlaying, setNowPlaying] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);

  function updateNowPlaying(value) {
    nowPlayingRef.current = value;
    setNowPlaying(value);
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function handleTimeUpdate() {
      setCurrentTime(audio.currentTime);
      const playing = nowPlayingRef.current;
      if (playing && audio.currentTime - lastSavedRef.current >= PROGRESS_SAVE_INTERVAL) {
        lastSavedRef.current = audio.currentTime;
        setProgress(playing.audioUrl, {
          position: audio.currentTime,
          duration: audio.duration || 0,
          title: playing.title,
          podcastTitle: playing.podcastTitle,
          artwork: playing.artwork,
        });
      }
    }

    function handleLoadedMetadata() {
      setDuration(audio.duration || 0);
      const playing = nowPlayingRef.current;
      if (playing) {
        const saved = getProgress(playing.audioUrl);
        if (saved?.position && saved.position < audio.duration * 0.95) {
          audio.currentTime = saved.position;
        }
      }
      audio.play().catch(() => {});
    }

    function handlePlay() {
      setIsPlaying(true);
    }

    function handlePause() {
      setIsPlaying(false);
    }

    function handleEnded() {
      setIsPlaying(false);
      const playing = nowPlayingRef.current;
      if (playing) clearProgress(playing.audioUrl);
    }

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  async function playEpisode(episode) {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    let src = episode.audioUrl;
    try {
      const downloaded = await getDownload(episode.audioUrl);
      if (downloaded) {
        src = URL.createObjectURL(downloaded.blob);
        objectUrlRef.current = src;
      }
    } catch {
      // IndexedDB unavailable — fall back to streaming from the network
    }

    updateNowPlaying({ ...episode, src });
    lastSavedRef.current = 0;
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);

    const audio = audioRef.current;
    audio.src = src;
    audio.playbackRate = playbackRate;
    // Playback starts from handleLoadedMetadata, once any saved position has
    // been applied — starting here too would play from 0 then visibly/audibly
    // jump once the seek lands.
  }

  function togglePlayPause() {
    const audio = audioRef.current;
    if (!audio || !nowPlaying) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }

  function seek(time) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(time, audio.duration || time));
    setCurrentTime(audio.currentTime);
  }

  function skip(seconds) {
    const audio = audioRef.current;
    if (!audio) return;
    seek(audio.currentTime + seconds);
  }

  function setPlaybackRate(rate) {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = rate;
    setPlaybackRateState(rate);
  }

  return (
    <PlayerContext.Provider
      value={{
        nowPlaying,
        isPlaying,
        currentTime,
        duration,
        playbackRate,
        playEpisode,
        togglePlayPause,
        seek,
        skip,
        setPlaybackRate,
      }}
    >
      {children}
      <audio ref={audioRef} style={{ display: "none" }} />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  return useContext(PlayerContext);
}
