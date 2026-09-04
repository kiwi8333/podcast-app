import { useRouter } from "next/router";
import { ChevronLeft } from "lucide-react";
import styles from "./ScreenHeader.module.css";

// Top-level tabs get an iOS large title; pushed screens get a compact bar
// with a back chevron, the way a UINavigationController presents them.
const TITLES = {
  "/": "Podcasts",
  "/favorites": "Library",
  "/downloads": "Downloads",
};

export default function ScreenHeader() {
  const router = useRouter();
  const title = TITLES[router.pathname];

  if (title) {
    return (
      <header className={styles.largeHeader}>
        <h1 className={styles.largeTitle}>{title}</h1>
      </header>
    );
  }

  return (
    <header className={styles.compactHeader}>
      <button type="button" onClick={() => router.back()} className={styles.backButton}>
        <ChevronLeft size={26} strokeWidth={2.2} aria-hidden="true" />
        <span>Back</span>
      </button>
    </header>
  );
}
