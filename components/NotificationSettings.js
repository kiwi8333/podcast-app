import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { isPushSupported, getExistingSubscription, enablePush, disablePush } from "@/lib/push/client";
import styles from "./NotificationSettings.module.css";

const MESSAGES = {
  denied: "Notifications are blocked for this site — enable them in your browser settings.",
  "no-subscriptions": "Follow a show first, then turn notifications on.",
  "save-failed": "Couldn't save that. Try again in a moment.",
  unsupported: "This browser can't do push notifications.",
};

export default function NotificationSettings({ favoritesCount }) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Checked after mount: none of this exists during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(isPushSupported());
    getExistingSubscription()
      .then((sub) => setEnabled(Boolean(sub)))
      .catch(() => {});
  }, []);

  if (!supported) return null;

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
      } else {
        await enablePush();
        setEnabled(true);
      }
    } catch (err) {
      setError(MESSAGES[err.message] ?? MESSAGES["save-failed"]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.row}>
      <button type="button" onClick={toggle} disabled={busy} className={styles.button}>
        {enabled ? <BellOff size={16} /> : <Bell size={16} />}
        {busy ? "Working…" : enabled ? "Turn off new-episode alerts" : "Notify me of new episodes"}
      </button>
      {error && <p className={styles.error}>{error}</p>}
      {enabled && !error && (
        <p className={styles.hint}>
          Covering {favoritesCount} {favoritesCount === 1 ? "show" : "shows"}. Turn this off and on
          again after following something new.
        </p>
      )}
    </div>
  );
}
