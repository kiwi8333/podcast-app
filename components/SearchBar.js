import { useState } from "react";
import { Search, X } from "lucide-react";
import styles from "./SearchBar.module.css";

export default function SearchBar({ onSearch, initialValue = "" }) {
  const [value, setValue] = useState(initialValue);

  function handleSubmit(e) {
    e.preventDefault();
    if (value.trim()) {
      onSearch(value.trim());
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form} role="search">
      {/* The magnifier and the clear button live inside the field, the way
          UISearchBar arranges them, rather than beside it as separate
          controls. The submit button is kept for keyboards without a Go key
          and for anyone driving this with a mouse. */}
      <div className={styles.field}>
        <Search size={16} className={styles.icon} aria-hidden="true" />
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search shows"
          aria-label="Search for a podcast"
          className={styles.input}
        />
        {value && (
          <button
            type="button"
            onClick={() => setValue("")}
            className={styles.clear}
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <button type="submit" className={styles.button} disabled={!value.trim()}>
        Search
      </button>
    </form>
  );
}
