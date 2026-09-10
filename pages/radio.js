import { useEffect, useMemo, useState } from "react";
import StationRow from "@/components/StationRow";
import Skeleton from "@/components/Skeleton";
import { fetchStations, filterStations } from "@/lib/radio";
import styles from "./Radio.module.css";

export default function RadioPage() {
  const [stations, setStations] = useState([]);
  const [status, setStatus] = useState("loading");
  const [query, setQuery] = useState("");

  useEffect(() => {
    // Abort on unmount so navigating away mid-fetch doesn't set state on a
    // component that is gone.
    const controller = new AbortController();

    fetchStations({ signal: controller.signal })
      .then((results) => {
        setStations(results);
        setStatus("done");
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setStatus("error");
      });

    return () => controller.abort();
  }, []);

  const visible = useMemo(() => filterStations(stations, query), [stations, query]);

  return (
    <div>
      <p className={styles.intro}>
        Live radio from Ghana. Streams come from the Radio Browser community
        directory and play straight through the app&apos;s player.
      </p>

      {status === "done" && stations.length > 0 && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, language or genre"
          aria-label="Filter stations"
          className={styles.filter}
        />
      )}

      {status === "loading" && (
        <div className={styles.list}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={styles.skeletonRow}>
              <Skeleton width={48} height={48} />
              <div className={styles.skeletonText}>
                <Skeleton width="55%" height={14} />
                <Skeleton width="30%" height={11} style={{ marginTop: 6 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {status === "error" && (
        <p className={styles.status}>
          Couldn&apos;t load stations right now. Pull down or try again shortly.
        </p>
      )}

      {status === "done" && stations.length === 0 && (
        <p className={styles.status}>No stations available at the moment.</p>
      )}

      {status === "done" && stations.length > 0 && visible.length === 0 && (
        <p className={styles.status}>No stations match &ldquo;{query}&rdquo;.</p>
      )}

      {visible.length > 0 && (
        <>
          <div className={styles.list}>
            {visible.map((station) => (
              <StationRow key={station.id} station={station} />
            ))}
          </div>
          <p className={styles.footnote}>
            {visible.length} station{visible.length === 1 ? "" : "s"}
            {query ? ` matching “${query}”` : ""}. Stations are listed by
            popularity; a stream that won&apos;t start has usually moved.
          </p>
        </>
      )}
    </div>
  );
}
