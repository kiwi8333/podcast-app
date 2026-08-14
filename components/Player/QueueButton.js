import { useState } from "react";
import { ListMusic } from "lucide-react";
import { useQueue } from "@/lib/queue";
import QueueDrawer from "./QueueDrawer";
import styles from "./QueueButton.module.css";

export default function QueueButton() {
  const [queue, , remove] = useQueue();
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.wrapper}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={styles.button}
        title="Up next"
        aria-label="Up next"
      >
        <ListMusic size={16} />
        {queue.length > 0 && <span className={styles.badge}>{queue.length}</span>}
      </button>

      {open && <QueueDrawer queue={queue} onRemove={remove} onClose={() => setOpen(false)} />}
    </div>
  );
}
