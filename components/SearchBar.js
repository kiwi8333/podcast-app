import { useState } from "react";

export default function SearchBar({ onSearch, initialValue = "" }) {
  const [value, setValue] = useState(initialValue);

  function handleSubmit(e) {
    e.preventDefault();
    if (value.trim()) {
      onSearch(value.trim());
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search for a podcast (e.g. This American Life)"
        style={{
          flex: 1,
          padding: "10px 12px",
          fontSize: 16,
          border: "1px solid #ccc",
          borderRadius: 6,
        }}
      />
      <button
        type="submit"
        style={{
          padding: "10px 18px",
          fontSize: 16,
          borderRadius: 6,
          border: "none",
          background: "#1a1a1a",
          color: "#fff",
          cursor: "pointer",
        }}
      >
        Search
      </button>
    </form>
  );
}
