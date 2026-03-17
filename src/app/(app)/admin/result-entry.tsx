"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Race {
  id: string;
  name: string;
  venue: string;
  status: string;
  runners: Array<{
    id: string;
    name: string;
    barrier: number | null;
    isScratched: boolean;
  }>;
}

export function ResultEntry({ races }: { races: Race[] }) {
  const router = useRouter();
  const [selectedRace, setSelectedRace] = useState<string>("");
  const [results, setResults] = useState<
    Array<{ runnerId: string; finishPosition: number; winDividend: string; placeDividend: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const race = races.find((r) => r.id === selectedRace);
  const activeRunners = race?.runners.filter((r) => !r.isScratched) || [];

  function handleSelectRace(raceId: string) {
    setSelectedRace(raceId);
    setResults([]);
    setMessage("");
  }

  function addResult() {
    setResults([...results, { runnerId: "", finishPosition: results.length + 1, winDividend: "", placeDividend: "" }]);
  }

  function updateResult(index: number, field: string, value: string) {
    const updated = [...results];
    updated[index] = { ...updated[index], [field]: value };
    setResults(updated);
  }

  function removeResult(index: number) {
    setResults(results.filter((_, i) => i !== index));
  }

  async function handleSettle() {
    if (!selectedRace || results.length === 0) return;

    // Validate
    const hasWinner = results.some((r) => r.finishPosition === 1);
    if (!hasWinner) {
      setMessage("Must have a 1st place finisher");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raceId: selectedRace,
          results: results.map((r) => ({
            runnerId: r.runnerId,
            finishPosition: r.finishPosition,
            winDividend: r.winDividend ? parseFloat(r.winDividend) : null,
            placeDividend: r.placeDividend ? parseFloat(r.placeDividend) : null,
          })),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(`Settled! ${data.message}`);
        setResults([]);
        setSelectedRace("");
        router.refresh();
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage(`Error: ${error}`);
    }
    setLoading(false);
  }

  // Only show races that can be settled (closed status, has runners)
  const settlableRaces = races.filter(
    (r) => (r.status === "closed" || r.status === "open") && r.runners.length > 0
  );

  const inputClasses =
    "bg-white border border-surface-muted rounded px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30";

  return (
    <div className="space-y-4">
      {settlableRaces.length === 0 ? (
        <p className="text-sm text-slate-400">No races ready for result entry.</p>
      ) : (
        <>
          <select
            value={selectedRace}
            onChange={(e) => handleSelectRace(e.target.value)}
            className="w-full bg-white border border-surface-muted rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-gold"
          >
            <option value="">Select a race...</option>
            {settlableRaces.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.venue}) — {r.status}
              </option>
            ))}
          </select>

          {race && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-semibold text-slate-900">
                  {race.name} — {activeRunners.length} active runners
                </h4>
                <button
                  onClick={addResult}
                  className="text-xs text-gold hover:text-gold-dark font-medium"
                >
                  + Add Placing
                </button>
              </div>

              {results.map((result, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="number"
                    value={result.finishPosition}
                    onChange={(e) => updateResult(i, "finishPosition", e.target.value)}
                    className={`w-12 ${inputClasses} text-center`}
                    min={1}
                    placeholder="#"
                  />
                  <select
                    value={result.runnerId}
                    onChange={(e) => updateResult(i, "runnerId", e.target.value)}
                    className={`flex-1 ${inputClasses}`}
                  >
                    <option value="">Select horse...</option>
                    {activeRunners.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.barrier ? `${r.barrier}. ` : ""}{r.name}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Win $"
                    value={result.winDividend}
                    onChange={(e) => updateResult(i, "winDividend", e.target.value)}
                    className={`w-20 ${inputClasses} placeholder-slate-400`}
                  />
                  <input
                    placeholder="Place $"
                    value={result.placeDividend}
                    onChange={(e) => updateResult(i, "placeDividend", e.target.value)}
                    className={`w-20 ${inputClasses} placeholder-slate-400`}
                  />
                  <button
                    onClick={() => removeResult(i)}
                    className="text-loss hover:text-red-700 text-sm"
                  >
                    ✕
                  </button>
                </div>
              ))}

              {results.length === 0 && (
                <div className="text-center py-4">
                  <button
                    onClick={() => {
                      // Pre-populate top 4 slots
                      setResults([
                        { runnerId: "", finishPosition: 1, winDividend: "", placeDividend: "" },
                        { runnerId: "", finishPosition: 2, winDividend: "", placeDividend: "" },
                        { runnerId: "", finishPosition: 3, winDividend: "", placeDividend: "" },
                        { runnerId: "", finishPosition: 4, winDividend: "", placeDividend: "" },
                      ]);
                    }}
                    className="text-sm text-gold hover:text-gold-dark font-medium"
                  >
                    Set up 1st–4th placings
                  </button>
                </div>
              )}

              {results.length > 0 && (
                <button
                  onClick={handleSettle}
                  disabled={loading || !results.every((r) => r.runnerId)}
                  className="w-full bg-gold hover:bg-gold-dark text-white font-bold text-sm px-4 py-3 rounded-lg transition disabled:opacity-50"
                >
                  {loading ? "Settling..." : "Enter Results & Settle"}
                </button>
              )}

              {message && (
                <p className={`text-sm ${message.startsWith("Error") ? "text-loss" : "text-profit"}`}>
                  {message}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
