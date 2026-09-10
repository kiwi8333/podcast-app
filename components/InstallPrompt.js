import { useCallback, useEffect, useRef, useState } from "react";
import { Share, Plus, X, ArrowDownToLine } from "lucide-react";
import {
  detectIos,
  detectInstalled,
  shouldOffer,
  getDismissedAt,
  recordDismissal,
} from "@/lib/install";
import styles from "./InstallPrompt.module.css";

export default function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  // The beforeinstallprompt event, held so the install button can replay it.
  // A ref rather than state: it is not rendered, and storing it in state
  // would re-render the tree for something nothing reads.
  const deferredRef = useRef(null);

  const evaluate = useCallback(() => {
    const installed = detectInstalled({
      displayModeStandalone: window.matchMedia("(display-mode: standalone)").matches,
      navigatorStandalone: window.navigator.standalone === true,
    });
    const onIos = detectIos(window.navigator.userAgent, window.navigator.maxTouchPoints);
    setIos(onIos);
    setVisible(
      shouldOffer({
        installed,
        canPrompt: deferredRef.current !== null,
        ios: onIos,
        dismissedAt: getDismissedAt(),
        now: Date.now(),
      })
    );
  }, []);

  useEffect(() => {
    function handleBeforeInstallPrompt(event) {
      // Without this Chrome shows its own mini-infobar instead, and the event
      // cannot be replayed later from our own button.
      event.preventDefault();
      deferredRef.current = event;
      evaluate();
    }

    function handleInstalled() {
      deferredRef.current = null;
      setVisible(false);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    // Runs for iOS too, where beforeinstallprompt never fires at all.
    // Hydrated after mount rather than during render: it reads navigator,
    // matchMedia and localStorage, none of which exist on the server, so
    // deciding this any earlier would mismatch the server-rendered markup.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    evaluate();

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, [evaluate]);

  async function handleInstall() {
    const deferred = deferredRef.current;
    if (!deferred) return;
    // Each event is good for one prompt; clear it either way so a second tap
    // cannot replay a spent one.
    deferredRef.current = null;
    setVisible(false);
    try {
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      // Declining the OS dialog is a "no" worth remembering, otherwise the
      // banner is back on the next page load.
      if (outcome !== "accepted") recordDismissal(Date.now());
    } catch {
      // Some browsers throw on a prompt that is no longer valid.
    }
  }

  function handleDismiss() {
    recordDismissal(Date.now());
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside className={styles.banner} aria-label="Install this app">
      <div className={styles.icon} aria-hidden="true">
        <ArrowDownToLine size={20} />
      </div>

      <div className={styles.body}>
        <div className={styles.title}>Add to your home screen</div>
        {ios ? (
          <div className={styles.text}>
            Tap <Share size={13} className={styles.inlineIcon} aria-label="Share" /> in
            Safari&apos;s toolbar, then{" "}
            <Plus size={13} className={styles.inlineIcon} aria-hidden="true" />
            <strong> Add to Home Screen</strong>.
          </div>
        ) : (
          <div className={styles.text}>
            Opens full screen, keeps your downloads, and works offline.
          </div>
        )}
      </div>

      {!ios && (
        <button type="button" onClick={handleInstall} className={styles.install}>
          Install
        </button>
      )}

      <button
        type="button"
        onClick={handleDismiss}
        className={styles.dismiss}
        aria-label="Dismiss"
      >
        <X size={18} />
      </button>
    </aside>
  );
}
