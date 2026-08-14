import { useState } from "react";
import { useRouter } from "next/router";
import styles from "./AddFeedForm.module.css";

export default function AddFeedForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    const url = value.trim();
    if (!/^https?:\/\//i.test(url)) {
      setError("Enter a full feed URL, starting with http:// or https://");
      return;
    }
    setError("");
    router.push(`/podcast/${encodeURIComponent(url)}`);
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Or paste an RSS feed URL"
        className={styles.input}
      />
      <button type="submit" className={styles.button}>
        Add
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </form>
  );
}
