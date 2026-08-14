import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Mic } from "lucide-react";
import "@/styles/globals.css";
import styles from "./App.module.css";
import { PlayerProvider } from "@/components/Player/PlayerContext";
import AudioPlayer from "@/components/Player/AudioPlayer";
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
      <div className={styles.shell}>
        <nav className={styles.nav}>
          <Link href="/" className={styles.brand}>
            <Mic size={18} />
            Podcasts
          </Link>
          <Link href="/favorites" className={styles.navLink}>
            My Subscriptions
            {hasNewEpisodes && <span className={styles.navBadge} title="New episodes" />}
          </Link>
          <Link href="/downloads" className={styles.navLink}>
            Downloads
          </Link>
        </nav>
        <div className={`${styles.page} ${transitioning ? styles.pageTransitioning : ""}`}>
          <Component {...pageProps} />
        </div>
      </div>
      <AudioPlayer />
    </PlayerProvider>
  );
}
