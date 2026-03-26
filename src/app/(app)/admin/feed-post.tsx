"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function FeedPost() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setMessage("");

    const res = await fetch("/api/admin/feed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, pinned }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setMessage("Posted!");
      setTitle("");
      setBody("");
      setPinned(false);
      router.refresh();
    } else {
      setMessage(`Error: ${data.error}`);
    }
  }

  const inputClasses =
    "w-full bg-white border border-surface-muted rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30";

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClasses}
            placeholder="Post title (e.g. 'Golden Slipper field confirmed')"
            required
          />
        </div>
        <div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={`${inputClasses} min-h-[80px]`}
            placeholder="Optional body text..."
            rows={3}
          />
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="rounded border-surface-muted text-gold focus:ring-gold/30"
            />
            Pin to top
          </label>
          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="bg-gold hover:bg-gold-dark text-white font-bold text-sm px-5 py-2 rounded-lg transition disabled:opacity-50"
          >
            {loading ? "Posting..." : "Post"}
          </button>
        </div>
      </form>

      {message && (
        <p className={`text-sm ${message.startsWith("Error") ? "text-loss" : "text-profit"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
