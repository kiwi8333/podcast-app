import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import "@/styles/globals.css";
import styles from "./App.module.css";
import { PlayerProvider } from "@/components/Player/PlayerContext";
import AudioPlayer from "@/components/Player/AudioPlayer";
import TabBar from "@/components/TabBar";
import InstallPrompt from "@/components/InstallPrompt";
import ScreenHeader from "@/components/ScreenHeader";
import { useFavoritesList } from "@/lib/favorites";

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const [transitioning, setTransitioning] = useState(false);
  const [favorites] = useFavoritesList();
  const hasNewEpisodes = favorites.some((f) => f.hasNewEpisode);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Production only. A service worker in dev caches Next's HMR chunks and
    // then serves stale ones back, which presents as edits silently not
    // taking effect — a genuinely confusing failure to debug.
    if (process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration fails on http:// origins and with storage disabled.
      // The app works without it; there is nothing to tell the user.
    });
  }, []);

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
        {/* Inline in the shell rather than a floating bar: the player and tab
            bar already own the bottom of the screen, and a third fixed layer
            would sit on top of one of them. */}
        <InstallPrompt />
        <div className={`${styles.page} ${transitioning ? styles.pageTransitioning : ""}`}>
          <Component {...pageProps} />
        </div>
      </div>
      <AudioPlayer />
      <TabBar hasNewEpisodes={hasNewEpisodes} />
    </PlayerProvider>
  );
}
