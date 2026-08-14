import { useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import styles from "./AskEpisodeChat.module.css";

const TEXT_TYPES = ["text/plain", "text/vtt", "application/srt", "application/json"];

function pickTranscript(transcripts) {
  return transcripts.find((t) => TEXT_TYPES.includes((t.type || "").toLowerCase())) || transcripts[0];
}

export default function AskEpisodeChat({ episode }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]); // [{role, content}]
  const [status, setStatus] = useState("idle"); // idle | loading | error

  if (!episode.transcripts?.length) return null;
  const transcript = pickTranscript(episode.transcripts);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || status === "loading") return;

    const nextMessages = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setQuestion("");
    setStatus("loading");

    fetch("/api/ai/ask-episode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: trimmed,
        transcriptUrl: transcript.url,
        transcriptType: transcript.type,
        title: episode.title,
        description: episode.description,
        conversationHistory: messages,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to answer");
        return res.json();
      })
      .then((data) => {
        setMessages([...nextMessages, { role: "assistant", content: data.answer }]);
        setStatus("idle");
      })
      .catch(() => setStatus("error"));
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={styles.openButton}>
        <MessageCircle size={13} />
        Ask this episode
      </button>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.messages}>
        {messages.length === 0 && (
          <p className={styles.hint}>Ask a question about this episode — answered from its transcript.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? styles.userMessage : styles.assistantMessage}>
            {m.content}
          </div>
        ))}
        {status === "loading" && <div className={styles.assistantMessage}>Thinking…</div>}
        {status === "error" && <p className={styles.error}>Couldn&apos;t answer that — try again.</p>}
      </div>
      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question…"
          className={styles.input}
        />
        <button type="submit" disabled={status === "loading"} className={styles.sendButton} aria-label="Send">
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
