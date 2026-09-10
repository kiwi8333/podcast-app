import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { ChevronLeft } from "lucide-react";
import styles from "./ScreenHeader.module.css";

// Top-level tabs get an iOS large title; pushed screens get a compact bar
// with a back chevron, the way a UINavigationController presents them.
const TITLES = {
  "/": "Podcasts",
  "/radio": "Radio",
  "/favorites": "Library",
  "/downloads": "Downloads",
};

// Roughly where the large title has scrolled out of view. Matching it to the
// title's own height is what makes the compact title appear as the large one
// leaves, rather than both being on screen together.
const COLLAPSE_AT = 32;

export default function ScreenHeader() {
  const router = useRouter();
  const title = TITLES[router.pathname];
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!title) return undefined;

    // rAF-throttled: scroll fires far faster than the screen refreshes, and
    // this only ever flips one boolean.
    let frame = 0;
    function handleScroll() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setCollapsed(window.scrollY > COLLAPSE_AT);
      });
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    // Run once for a screen restored mid-page, where no scroll event fires.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(window.scrollY > COLLAPSE_AT);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [title]);

  if (title) {
    return (
      <>
        {/* Sits above the large title and fades in as it scrolls away, so the
            screen always has a title somewhere without ever showing two. */}
        <div
          className={`${styles.bar} ${collapsed ? styles.barVisible : ""}`}
          aria-hidden="true"
        >
          <span className={styles.barTitle}>{title}</span>
        </div>
        <header className={styles.largeHeader}>
          <h1 className={styles.largeTitle}>{title}</h1>
        </header>
      </>
    );
  }

  return (
    <div className={`${styles.bar} ${styles.barVisible} ${styles.barLeading}`}>
      <button type="button" onClick={() => router.back()} className={styles.backButton}>
        <ChevronLeft size={26} strokeWidth={2.4} aria-hidden="true" />
        <span>Back</span>
      </button>
    </div>
  );
}
