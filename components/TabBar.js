import Link from "next/link";
import { useRouter } from "next/router";
import { Home, Radio, Library, ArrowDownCircle } from "lucide-react";
import styles from "./TabBar.module.css";

const TABS = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/radio", label: "Radio", Icon: Radio },
  { href: "/favorites", label: "Library", Icon: Library, badgeKey: "hasNewEpisodes" },
  { href: "/downloads", label: "Downloads", Icon: ArrowDownCircle },
];

export default function TabBar({ hasNewEpisodes = false }) {
  const router = useRouter();

  return (
    <nav className={styles.tabBar} aria-label="Main">
      {TABS.map(({ href, label, Icon, badgeKey }) => {
        // "/" would otherwise match every route under startsWith.
        const active = href === "/" ? router.pathname === "/" : router.pathname.startsWith(href);
        const showBadge = badgeKey === "hasNewEpisodes" && hasNewEpisodes;
        return (
          <Link
            key={href}
            href={href}
            className={`${styles.tab} ${active ? styles.tabActive : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className={styles.iconWrap}>
              <Icon size={24} strokeWidth={active ? 2.4 : 1.9} aria-hidden="true" />
              {showBadge && <span className={styles.badge} aria-label="New episodes" />}
            </span>
            <span className={styles.label}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
