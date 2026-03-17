"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Runner {
  id: string;
  name: string;
  barrier: number | null;
}

interface TipLine {
  runnerId: string;
  backupRunnerId?: string;
  betType: "win" | "place";
  amount: number;
}

export function TipForm({
  raceId,
  cutoffAt,
  runners,
  existingTip,
}: {
  raceId: string;
  cutoffAt: string;
  runners: Runner[];
  existingTip?: { lines: TipLine[] };
}) {
  const router = useRouter();
  const [lines, setLines] = useState<TipLine[]>(
    existingTip?.lines || [
      { runnerId: "", backupRunnerId: undefined, betType: "win", amount: 0 },
    ]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const totalAmount = lines.reduce((sum, l) => sum + (l.amount || 0), 0);
  const remaining = 100 - totalAmount;
  const isValid =
    Math.abs(totalAmount - 100) < 0.01 &&
    lines.every((l) => l.runnerId && l.amount > 0) &&
    lines.length <= 4;

  function updateLine(index: number, update: Partial<TipLine>) {
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, ...update } : l))
    );
    setSuccess(false);
  }

  function addLine() {
    if (lines.length >= 4) return;
    setLines((prev) => [
      ...prev,
      { runnerId: "", backupRunnerId: undefined, betType: "win", amount: 0 },
    ]);
  }

  function removeLine(index: number) {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  // Get runners already selected as primary in other lines
  function getUsedRunnerIds(excludeIndex: number): Set<string> {
    return new Set(
      lines.filter((_, i) => i !== excludeIndex).map((l) => l.runnerId)
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/tips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raceId, lines }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to submit tips");
      } else {
        setSuccess(true);
        router.refresh();
      }
    } catch {
      setError("Something went wrong");
    }

    setLoading(false);
  }

  async function handleDelete() {
    setLoading(true);
    try {
      await fetch(`/api/tips?raceId=${raceId}`, { method: "DELETE" });
      setLines([
        { runnerId: "", backupRunnerId: undefined, betType: "win", amount: 0 },
      ]);
      setSuccess(false);
      router.refresh();
    } catch {
      // ignore
    }
    setLoading(false);
  }

  // Live cutoff check — disable form if cutoff passes while user is on page
  const [isExpired, setIsExpired] = useState(false);
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);

  useEffect(() => {
    function checkCutoff() {
      const remaining = new Date(cutoffAt).getTime() - Date.now();
      if (remaining <= 0) {
        setIsExpired(true);
        setMinutesLeft(0);
      } else {
        setMinutesLeft(Math.ceil(remaining / 60000));
      }
    }
    checkCutoff();
    const timer = setInterval(checkCutoff, 15000);
    return () => clearInterval(timer);
  }, [cutoffAt]);

  if (isExpired) {
    return (
      <div className="bg-loss/10 border border-loss/30 rounded-xl p-5 text-center">
        <p className="text-loss font-bold">Tips are now closed</p>
        <p className="text-sm text-slate-400 mt-1">The cutoff has passed. Refresh the page to see all tips.</p>
      </div>
    );
  }

  return (
    <div className="bg-navy-card rounded-xl p-5 border border-navy-border">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold text-gold uppercase tracking-wide">
          {existingTip ? "Edit Your Tips" : "Submit Tips"}
        </h3>
        <div className="text-right">
          {minutesLeft !== null && minutesLeft <= 60 && (
            <p className={`text-xs font-semibold ${minutesLeft <= 15 ? "text-loss" : "text-orange-400"}`}>
              {minutesLeft}min left
            </p>
          )}
          <p className="text-sm">
            Budget: <span className="font-bold text-white">$100</span>
          </p>
          <p
            className={`text-xs ${
              Math.abs(remaining) < 0.01
                ? "text-profit"
                : remaining < 0
                  ? "text-loss"
                  : "text-slate-400"
            }`}
          >
            Remaining: ${remaining.toFixed(0)}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-loss/10 border border-loss/30 text-loss rounded-lg px-4 py-2 mb-4 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-profit/10 border border-profit/30 text-profit rounded-lg px-4 py-2 mb-4 text-sm">
          Tips submitted successfully!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {lines.map((line, i) => {
          const usedIds = getUsedRunnerIds(i);
          return (
            <div
              key={i}
              className="bg-navy-light rounded-lg p-4 border border-navy-border"
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs text-slate-400 font-medium">
                  BET {i + 1}
                </span>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="text-xs text-loss hover:text-loss/80"
                  >
                    Remove
                  </button>
                )}
              </div>

              {/* Horse selection */}
              <div className="mb-3">
                <label className="block text-xs text-slate-400 mb-1">
                  Horse
                </label>
                <select
                  value={line.runnerId}
                  onChange={(e) =>
                    updateLine(i, { runnerId: e.target.value })
                  }
                  className="w-full bg-navy border border-navy-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold"
                >
                  <option value="">Select horse...</option>
                  {runners
                    .filter(
                      (r) => !usedIds.has(r.id) || r.id === line.runnerId
                    )
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.barrier ? `${r.barrier}. ` : ""}
                        {r.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Bet type + Amount */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Type
                  </label>
                  <select
                    value={line.betType}
                    onChange={(e) =>
                      updateLine(i, {
                        betType: e.target.value as "win" | "place",
                      })
                    }
                    className="w-full bg-navy border border-navy-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold"
                  >
                    <option value="win">Win</option>
                    <option value="place">Place</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Amount ($)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={line.amount || ""}
                    onChange={(e) =>
                      updateLine(i, {
                        amount: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-navy border border-navy-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Backup horse */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Backup (if scratched)
                </label>
                <select
                  value={line.backupRunnerId || ""}
                  onChange={(e) =>
                    updateLine(i, {
                      backupRunnerId: e.target.value || undefined,
                    })
                  }
                  className="w-full bg-navy border border-navy-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold"
                >
                  <option value="">No backup</option>
                  {runners
                    .filter((r) => r.id !== line.runnerId)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.barrier ? `${r.barrier}. ` : ""}
                        {r.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          );
        })}

        {/* Add bet button */}
        {lines.length < 4 && (
          <button
            type="button"
            onClick={addLine}
            className="w-full py-2 border border-dashed border-navy-border rounded-lg text-sm text-slate-400 hover:text-gold hover:border-gold/30 transition"
          >
            + Add Another Bet ({lines.length}/4)
          </button>
        )}

        {/* Summary */}
        <div className="bg-navy rounded-lg p-4 border border-navy-border">
          <h4 className="text-xs text-slate-400 mb-2 uppercase">Summary</h4>
          {lines
            .filter((l) => l.runnerId && l.amount > 0)
            .map((l, i) => {
              const runner = runners.find((r) => r.id === l.runnerId);
              return (
                <div key={i} className="flex justify-between text-sm">
                  <span>
                    ${l.amount} {l.betType.toUpperCase()}{" "}
                    {runner?.name || "..."}
                  </span>
                </div>
              );
            })}
          <div className="mt-2 pt-2 border-t border-navy-border flex justify-between text-sm font-bold">
            <span>Total</span>
            <span
              className={
                Math.abs(totalAmount - 100) < 0.01
                  ? "text-profit"
                  : "text-loss"
              }
            >
              ${totalAmount.toFixed(0)}{" "}
              {Math.abs(totalAmount - 100) < 0.01 ? "✓" : ""}
            </span>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!isValid || loading}
            className="flex-1 bg-gold hover:bg-gold-dark text-navy font-bold py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading
              ? "Submitting..."
              : existingTip
                ? "Update Tips"
                : "Submit Tips"}
          </button>
          {existingTip && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="px-4 bg-loss/10 text-loss rounded-lg hover:bg-loss/20 transition disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
