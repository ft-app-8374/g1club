"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ExistingResult {
  runnerId: string;
  finishPosition: number;
  winDividend: number | null;
  placeDividend: number | null;
}

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
  existingResults?: ExistingResult[];
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

  // Races needing admin action (have results with finishPosition=0)
  const needsAction = races.filter(
    (r) => r.existingResults?.some((res) => res.finishPosition === 0)
  );

  function handleSelectRace(raceId: string) {
    setSelectedRace(raceId);
    setMessage("");
    const selected = races.find((r) => r.id === raceId);
    if (selected?.existingResults && selected.existingResults.length > 0) {
      // Pre-populate: winner first (pos=1), then unconfirmed (pos=0 → show as 2, 3...)
      const sorted = [...selected.existingResults].sort((a, b) => {
        if (a.finishPosition === 1) return -1;
        if (b.finishPosition === 1) return 1;
        if (a.finishPosition === 0 && b.finishPosition === 0) return 0;
        if (a.finishPosition === 0) return 1;
        if (b.finishPosition === 0) return -1;
        return a.finishPosition - b.finishPosition;
      });

      // Assign sequential positions to unconfirmed runners
      let nextPos = 2;
      setResults(
        sorted.map((r) => ({
          runnerId: r.runnerId,
          finishPosition: r.finishPosition === 0 ? nextPos++ : r.finishPosition,
          winDividend: r.winDividend ? r.winDividend.toString() : "",
          placeDividend: r.placeDividend ? r.placeDividend.toString() : "",
        }))
      );
    } else {
      setResults([]);
    }
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

  function getRunnerName(runnerId: string): string {
    const runner = activeRunners.find((r) => r.id === runnerId);
    return runner ? `${runner.barrier ? runner.barrier + ". " : ""}${runner.name}` : "";
  }

  async function handleSettle() {
    if (!selectedRace || results.length === 0) return;

    const hasWinner = results.some((r) => r.finishPosition === 1);
    if (!hasWinner) {
      setMessage("Must have a 1st place finisher");
      return;
    }

    const hasUnordered = results.some((r) => r.finishPosition === 0);
    if (hasUnordered) {
      setMessage("Set finish position for all runners before settling");
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

  const settlableRaces = races.filter(
    (r) => ["closed", "open", "final"].includes(r.status) && r.runners.length > 0
  );

  const inputClasses =
    "bg-white border border-surface-muted rounded px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30";

  return (
    <div className="space-y-4">
      {/* Alert for races needing action */}
      {needsAction.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <p className="text-sm font-bold text-orange-700 mb-1">
            {needsAction.length} race{needsAction.length > 1 ? "s" : ""} need 2nd/3rd confirmed
          </p>
          {needsAction.map((r) => (
            <button
              key={r.id}
              onClick={() => handleSelectRace(r.id)}
              className="block text-sm text-orange-600 hover:text-orange-800 font-medium py-0.5"
            >
              {r.name} ({r.venue}) →
            </button>
          ))}
        </div>
      )}

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
            {settlableRaces.map((r) => {
              const needs = r.existingResults?.some((res) => res.finishPosition === 0);
              return (
                <option key={r.id} value={r.id}>
                  {needs ? "⚠ " : ""}{r.name} ({r.venue}) — {r.status}
                  {needs ? " — confirm places" : ""}
                </option>
              );
            })}
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
                    className={`w-12 ${inputClasses} text-center ${
                      result.finishPosition === 1 ? "bg-gold/10 border-gold font-bold" : ""
                    }`}
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
                      setResults([
                        { runnerId: "", finishPosition: 1, winDividend: "", placeDividend: "" },
                        { runnerId: "", finishPosition: 2, winDividend: "", placeDividend: "" },
                        { runnerId: "", finishPosition: 3, winDividend: "", placeDividend: "" },
                      ]);
                    }}
                    className="text-sm text-gold hover:text-gold-dark font-medium"
                  >
                    Set up 1st–3rd placings
                  </button>
                </div>
              )}

              {results.length > 0 && (
                <>
                  {/* Summary */}
                  <div className="bg-surface rounded-lg p-3 text-xs text-slate-600">
                    {results.filter((r) => r.runnerId).map((r) => (
                      <div key={r.runnerId} className="flex justify-between py-0.5">
                        <span>{r.finishPosition === 1 ? "🏆" : `${r.finishPosition}.`} {getRunnerName(r.runnerId)}</span>
                        <span>
                          {r.winDividend ? `W $${r.winDividend}` : ""}
                          {r.placeDividend ? ` P $${r.placeDividend}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleSettle}
                    disabled={loading || !results.every((r) => r.runnerId && r.finishPosition >= 1)}
                    className="w-full bg-gold hover:bg-gold-dark text-white font-bold text-sm px-4 py-3 rounded-lg transition disabled:opacity-50"
                  >
                    {loading ? "Settling..." : race.status === "final" ? "Re-Settle Race" : "Enter Results & Settle"}
                  </button>
                </>
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
