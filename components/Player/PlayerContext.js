import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getDownload } from "@/lib/downloads";
import { getProgress, setProgress, clearProgress } from "@/lib/playbackProgress";
import { getQueue, removeFromQueue } from "@/lib/queue";

const PlayerContext = createContext(null);
// currentTime/duration change ~4x a second while an episode plays. Kept in
// their own context so that ticking only re-renders what actually shows a
// clock (AudioPlayer, Transcript) — previously every usePlayer() consumer
// re-rendered on every tick, including one EpisodeRow per episode in a feed
// list of fifty.
const PlayerTimeContext = createContext({ currentTime: 0, duration: 0 });
const PROGRESS_SAVE_INTERVAL = 5;

export function PlayerProvider({ children }) {
  const audioRef = useRef(null);
  const objectUrlRef = useRef(null);
  const nowPlayingRef = useRef(null);
  const lastSavedRef = useRef(0);
  // Always points at this render's playEpisode, so the mount-time handleEnded
  // closure (registered once, deps []) auto-advances using the current
  // playbackRate instead of whatever it was when the component first mounted.
  const playEpisodeRef = useRef(null);

  const [nowPlaying, setNowPlaying] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);

  // Sleep timer is intentionally session-only (not persisted to localStorage,
  // unlike favorites/progress/queue) — it should reset on reload.
  const sleepTargetRef = useRef(null); // null | epoch-ms | "end-of-episode"
  const [sleepMinutesRemaining, setSleepMinutesRemaining] = useState(null);
  const [sleepMode, setSleepMode] = useState("off"); // "off" | "countdown" | "end"

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
      // A live stream has no position worth resuming from. Saving one would
      // file every station tapped into Continue Listening and spend the
      // progress record's 300-entry budget on entries nothing can use.
      if (playing?.isLive) return;
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
      // duration is Infinity on a live stream, so the 95% test below would
      // pass for any saved position and then seek a stream that cannot seek.
      if (playing && !playing.isLive) {
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
      // "ended" on a live stream means the connection dropped, not that
      // anything finished. Advancing into the podcast queue on a dropped
      // stream would start an unrelated episode by itself.
      if (playing?.isLive) return;
      if (playing) clearProgress(playing.audioUrl);

      const sleepAtEnd = sleepTargetRef.current === "end-of-episode";
      if (sleepAtEnd) {
        sleepTargetRef.current = null;
        setSleepMinutesRemaining(null);
        setSleepMode("off");
      }

      if (!sleepAtEnd) {
        const next = getQueue()[0];
        if (next) {
          removeFromQueue(next.audioUrl);
          playEpisodeRef.current?.(next);
        }
      }
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

  const playEpisode = useCallback(async (episode) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    let src = episode.audioUrl;
    // Nothing live is ever in the downloads store, so this lookup would
    // always miss — and it sits directly in front of starting playback.
    if (!episode.isLive) {
      try {
        const downloaded = await getDownload(episode.audioUrl);
        if (downloaded) {
          src = URL.createObjectURL(downloaded.blob);
          objectUrlRef.current = src;
        }
      } catch {
        // IndexedDB unavailable — fall back to streaming from the network
      }
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
  }, [playbackRate]);

  useEffect(() => {
    playEpisodeRef.current = playEpisode;
  });

  // A station plays through the same path as an episode — same <audio>
  // element, same controls — with isLive marking the branches that must not
  // treat it as a recording.
  const playStation = useCallback(
    (station) =>
      playEpisode({
        audioUrl: station.streamUrl,
        title: station.name,
        podcastTitle: station.tags?.[0] ? `Live · ${station.tags[0]}` : "Live radio",
        artwork: station.logo || null,
        isLive: true,
      }),
    [playEpisode]
  );

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !nowPlaying) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }, [nowPlaying]);

  const seek = useCallback((time) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(time, audio.duration || time));
    setCurrentTime(audio.currentTime);
  }, []);

  const skip = useCallback((seconds) => {
    const audio = audioRef.current;
    if (!audio) return;
    seek(audio.currentTime + seconds);
  }, [seek]);

  const setPlaybackRate = useCallback((rate) => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = rate;
    setPlaybackRateState(rate);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const target = sleepTargetRef.current;
      if (typeof target !== "number") return;

      const remainingMs = target - Date.now();
      if (remainingMs <= 0) {
        sleepTargetRef.current = null;
        setSleepMinutesRemaining(null);
        setSleepMode("off");
        audioRef.current?.pause();
        return;
      }
      setSleepMinutesRemaining(Math.ceil(remainingMs / 60000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const setSleepTimer = useCallback((minutes) => {
    sleepTargetRef.current = Date.now() + minutes * 60 * 1000;
    setSleepMinutesRemaining(minutes);
    setSleepMode("countdown");
  }, []);

  const setSleepAtEndOfEpisode = useCallback(() => {
    sleepTargetRef.current = "end-of-episode";
    setSleepMinutesRemaining(null);
    setSleepMode("end");
  }, []);

  const cancelSleepTimer = useCallback(() => {
    sleepTargetRef.current = null;
    setSleepMinutesRemaining(null);
    setSleepMode("off");
  }, []);

  // Lock-screen and notification controls. On a phone this is the surface
  // people actually use to pause a podcast — without it the episode is
  // uncontrollable the moment the screen locks.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;

    if (!nowPlaying) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
      return;
    }

    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: nowPlaying.title || "",
      artist: nowPlaying.podcastTitle || "",
      album: nowPlaying.podcastTitle || "",
      artwork: nowPlaying.artwork ? [{ src: nowPlaying.artwork, sizes: "512x512" }] : [],
    });
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

    // Match the in-app buttons: 15s either way. Live gets play/pause only —
    // putting scrub controls on the lock screen for something with no
    // timeline leaves the user pressing buttons that cannot do anything.
    const handlers = [
      ["play", () => audioRef.current?.play().catch(() => {})],
      ["pause", () => audioRef.current?.pause()],
      ...(nowPlaying.isLive
        ? []
        : [
            ["seekbackward", (d) => skip(-(d?.seekOffset || 15))],
            ["seekforward", (d) => skip(d?.seekOffset || 15)],
            ["seekto", (d) => seek(d?.seekTime ?? 0)],
          ]),
    ];
    for (const [action, handler] of handlers) {
      // Not every browser implements every action; an unsupported one throws
      // rather than being ignored, and would take the rest down with it.
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // unsupported action — skip it
      }
    }

    return () => {
      for (const [action] of handlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // nothing to clear
        }
      }
    };
    // seek/skip are stable in behaviour and only read refs, so they're
    // deliberately not deps — including them would re-register handlers on
    // every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowPlaying, isPlaying]);

  // Position is set on state changes rather than on every timeupdate: the
  // platform extrapolates the playhead from position + playbackRate, so
  // re-sending it four times a second buys nothing.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    if (!navigator.mediaSession.setPositionState) return;
    if (!nowPlaying || !Number.isFinite(duration) || duration <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate,
        position: Math.min(Math.max(audioRef.current?.currentTime || 0, 0), duration),
      });
    } catch {
      // some browsers reject a position state mid-load — harmless
    }
  }, [nowPlaying, duration, playbackRate, isPlaying]);

  // Without this the value object was rebuilt on every render, so every
  // consumer re-rendered even when nothing it reads had changed.
  const value = useMemo(
    () => ({
      nowPlaying,
      isPlaying,
      playbackRate,
      playEpisode,
      playStation,
      togglePlayPause,
      seek,
      skip,
      setPlaybackRate,
      sleepMinutesRemaining,
      sleepMode,
      setSleepTimer,
      setSleepAtEndOfEpisode,
      cancelSleepTimer,
    }),
    [
      nowPlaying,
      isPlaying,
      playbackRate,
      playEpisode,
      playStation,
      togglePlayPause,
      seek,
      skip,
      setPlaybackRate,
      sleepMinutesRemaining,
      sleepMode,
      setSleepTimer,
      setSleepAtEndOfEpisode,
      cancelSleepTimer,
    ]
  );

  const timeValue = useMemo(() => ({ currentTime, duration }), [currentTime, duration]);

  return (
    <PlayerContext.Provider value={value}>
      <PlayerTimeContext.Provider value={timeValue}>
        {children}
        <audio ref={audioRef} style={{ display: "none" }} />
      </PlayerTimeContext.Provider>
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  return useContext(PlayerContext);
}

// Separate hook on purpose: reading this subscribes a component to the
// ~4Hz playback tick, so only components that display a time should use it.
export function usePlayerTime() {
  return useContext(PlayerTimeContext);
}
