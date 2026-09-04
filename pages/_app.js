import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import "@/styles/globals.css";
import styles from "./App.module.css";
import { PlayerProvider } from "@/components/Player/PlayerContext";
import AudioPlayer from "@/components/Player/AudioPlayer";
import TabBar from "@/components/TabBar";
import ScreenHeader from "@/components/ScreenHeader";
import { useFavoritesList } from "@/lib/favorites";

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const [transitioning, setTransitioning] = useState(false);
  const [favorites] = useFavoritesList();
  const hasNewEpisodes = favorites.some((f) => f.hasNewEpisode);

  useEffect(() => {
    function handleStart() {
      setTransitioning(true);
    }
    function handleComplete() {
      setTransitioning(false);
    }

    router.events.on("routeChangeStart", handleStart);
    router.events.on("routeChangeComplete", handleComplete);
    router.events.on("routeChangeError", handleComplete);
    return () => {
      router.events.off("routeChangeStart", handleStart);
      router.events.off("routeChangeComplete", handleComplete);
      router.events.off("routeChangeError", handleComplete);
    };
  }, [router]);

  return (
    <PlayerProvider>
      <Head>
        {/* viewport-fit=cover is what makes env(safe-area-inset-*) resolve to
            anything but 0 — without it the tab bar sits under the home
            indicator on a notched iPhone. Lives here, not _document, because
            Next warns against a viewport meta in _document. */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <div className={styles.shell}>
        {/* Titles live here rather than in each page: downloads.js early-returns
            for its empty state, so a per-page header would vanish exactly when
            an empty screen most needs a label. */}
        <ScreenHeader />
        <div className={`${styles.page} ${transitioning ? styles.pageTransitioning : ""}`}>
          <Component {...pageProps} />
        </div>
      </div>
      <AudioPlayer />
      <TabBar hasNewEpisodes={hasNewEpisodes} />
    </PlayerProvider>
  );
}
