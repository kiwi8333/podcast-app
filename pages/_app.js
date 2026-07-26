import Link from "next/link";
import "@/styles/globals.css";
import { PlayerProvider } from "@/components/Player/PlayerContext";
import AudioPlayer from "@/components/Player/AudioPlayer";

export default function App({ Component, pageProps }) {
  return (
    <PlayerProvider>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px 100px" }}>
        <nav style={{ display: "flex", gap: 16, marginBottom: 24 }}>
          <Link href="/" style={{ fontWeight: 700, textDecoration: "none", color: "inherit" }}>
            🎙 Podcasts
          </Link>
          <Link href="/favorites" style={{ textDecoration: "none", color: "inherit" }}>
            My Subscriptions
          </Link>
          <Link href="/downloads" style={{ textDecoration: "none", color: "inherit" }}>
            Downloads
          </Link>
        </nav>
        <Component {...pageProps} />
      </div>
      <AudioPlayer />
    </PlayerProvider>
  );
}
