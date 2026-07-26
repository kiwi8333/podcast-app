import { createContext, useContext, useRef, useState } from "react";
import { getDownload } from "@/lib/downloads";

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  const [nowPlaying, setNowPlaying] = useState(null);
  const currentObjectUrl = useRef(null);

  async function playEpisode(episode) {
    if (currentObjectUrl.current) {
      URL.revokeObjectURL(currentObjectUrl.current);
      currentObjectUrl.current = null;
    }

    let src = episode.audioUrl;
    try {
      const downloaded = await getDownload(episode.audioUrl);
      if (downloaded) {
        src = URL.createObjectURL(downloaded.blob);
        currentObjectUrl.current = src;
      }
    } catch {
      // IndexedDB unavailable — fall back to streaming from the network
    }

    setNowPlaying({ ...episode, src });
  }

  return (
    <PlayerContext.Provider value={{ nowPlaying, playEpisode }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  return useContext(PlayerContext);
}
