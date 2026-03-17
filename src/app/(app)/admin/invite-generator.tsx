"use client";

import { useState } from "react";

export function InviteCodeGenerator() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/invite", { method: "POST" });
      const data = await res.json();
      if (data.code) {
        setCode(data.code);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }

  return (
    <div>
      <button
        onClick={generate}
        disabled={loading}
        className="bg-gold hover:bg-gold-dark text-white font-bold text-sm px-4 py-2 rounded-lg transition disabled:opacity-50"
      >
        {loading ? "Generating..." : "Generate Invite Code"}
      </button>
      {code && (
        <p className="mt-2 text-sm text-slate-700">
          New code:{" "}
          <code className="text-gold bg-gold-accent px-2 py-1 rounded font-medium">
            {code}
          </code>
        </p>
      )}
    </div>
  );
}
