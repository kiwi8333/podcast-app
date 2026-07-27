import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Mic } from "lucide-react";
import "@/styles/globals.css";
import styles from "./App.module.css";
import { PlayerProvider } from "@/components/Player/PlayerContext";
import AudioPlayer from "@/components/Player/AudioPlayer";

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const [transitioning, setTransitioning] = useState(false);

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
