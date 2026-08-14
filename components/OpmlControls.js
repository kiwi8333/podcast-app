import { useRef } from "react";
import { exportOpml, parseOpml } from "@/lib/opml";
import { addFavorite } from "@/lib/favorites";
import styles from "./OpmlControls.module.css";

export default function OpmlControls({ favorites, onImport }) {
  const fileInputRef = useRef(null);

  function handleExport() {
    const blob = new Blob([exportOpml(favorites)], { type: "text/x-opml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "podcast-subscriptions.opml";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const text = await file.text();
    const entries = parseOpml(text);
    for (const entry of entries) {
      addFavorite({ feedUrl: entry.feedUrl, title: entry.title });
    }
    onImport?.();
  }

  return (
    <div className={styles.controls}>
      <button onClick={handleExport} className={styles.button} disabled={favorites.length === 0}>
        Export OPML
      </button>
      <button onClick={() => fileInputRef.current?.click()} className={styles.button}>
        Import OPML
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".opml,.xml,text/x-opml,text/xml"
        onChange={handleImportChange}
        className={styles.hiddenInput}
      />
    </div>
  );
}
