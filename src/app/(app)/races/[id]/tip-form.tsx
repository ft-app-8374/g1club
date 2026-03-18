"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Runner {
  id: string;
  name: string;
  barrier: number | null;
  runnerNumber: number;
}

interface TipLine {
  runnerId: string;
  backupRunnerId?: string;
  betType: "win" | "place" | "eachway";
  amount: number;
}

// Internal line sent to API (always win or place)
interface ApiTipLine {
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
  existingTip?: { lines: ApiTipLine[] };
}) {
  const router = useRouter();

  // Collapse existing each-way pairs back into a single eachway line for editing
  function initLines(): TipLine[] {
    if (!existingTip?.lines?.length) {
      return [{ runnerId: "", backupRunnerId: undefined, betType: "win", amount: 0 }];
    }
    const lines = existingTip.lines;
    const used = new Set<number>();
    const result: TipLine[] = [];

    for (let i = 0; i < lines.length; i++) {
      if (used.has(i)) continue;
      // Check if there's a matching pair (same runner, one win + one place, same amount)
      let paired = false;
      for (let j = i + 1; j < lines.length; j++) {
        if (used.has(j)) continue;
        if (
          lines[i].runnerId === lines[j].runnerId &&
          lines[i].amount === lines[j].amount &&
          ((lines[i].betType === "win" && lines[j].betType === "place") ||
            (lines[i].betType === "place" && lines[j].betType === "win"))
        ) {
          result.push({
            runnerId: lines[i].runnerId,
            backupRunnerId: lines[i].backupRunnerId,
            betType: "eachway",
            amount: lines[i].amount, // per-leg amount
          });
          used.add(i);
          used.add(j);
          paired = true;
          break;
        }
      }
      if (!paired) {
        result.push({
          runnerId: lines[i].runnerId,
          backupRunnerId: lines[i].backupRunnerId,
          betType: lines[i].betType as "win" | "place",
          amount: lines[i].amount,
        });
        used.add(i);
      }
    }
    return result;
  }

  const [lines, setLines] = useState<TipLine[]>(initLines);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [successTimer, setSuccessTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Compute the effective total (each-way counts double)
  const totalAmount = lines.reduce((sum, l) => {
    const amt = l.amount || 0;
    return sum + (l.betType === "eachway" ? amt * 2 : amt);
  }, 0);
  const remaining = 100 - totalAmount;

  // Validation helpers
  function getValidationErrors(): string[] {
    const errors: string[] = [];
    if (lines.every((l) => !l.runnerId && !l.amount)) {
      errors.push("Add at least one bet to submit your tips");
      return errors;
    }
    lines.forEach((l, i) => {
      if (!l.runnerId) errors.push(`Select a runner for bet #${i + 1}`);
      if (!l.amount || l.amount <= 0) errors.push(`Enter an amount for bet #${i + 1}`);
    });
    if (Math.abs(totalAmount - 100) >= 0.01) {
      errors.push(`Your bets total $${totalAmount.toFixed(0)} \u2014 must equal $100 to submit`);
    }
    return errors;
  }

  // The maximum number of API lines allowed is 4
  function getApiLineCount(): number {
    return lines.reduce((count, l) => count + (l.betType === "eachway" ? 2 : 1), 0);
  }

  const validationErrors = getValidationErrors();
  const isValid = validationErrors.length === 0 && getApiLineCount() <= 4;

  function updateLine(index: number, update: Partial<TipLine>) {
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, ...update } : l))
    );
    setSuccess(false);
    if (successTimer) {
      clearTimeout(successTimer);
      setSuccessTimer(null);
    }
  }

  function addLine() {
    if (getApiLineCount() >= 4) return;
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

  // Expand each-way into two API lines
  function expandLines(): ApiTipLine[] {
    const result: ApiTipLine[] = [];
    for (const line of lines) {
      if (line.betType === "eachway") {
        result.push({
          runnerId: line.runnerId,
          backupRunnerId: line.backupRunnerId,
          betType: "win",
          amount: line.amount,
        });
        result.push({
          runnerId: line.runnerId,
          backupRunnerId: line.backupRunnerId,
          betType: "place",
          amount: line.amount,
        });
      } else {
        result.push({
          runnerId: line.runnerId,
          backupRunnerId: line.backupRunnerId,
          betType: line.betType,
          amount: line.amount,
        });
      }
    }
    return result;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const apiLines = expandLines();
      const res = await fetch("/api/tips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raceId, lines: apiLines }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to submit tips");
      } else {
        setSuccess(true);
        // After 3 seconds, keep success state but user can still edit
        const timer = setTimeout(() => {
          // success stays true — button shows "Edit Tips"
        }, 3000);
        setSuccessTimer(timer);
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

  // Cleanup success timer
  useEffect(() => {
    return () => {
      if (successTimer) clearTimeout(successTimer);
    };
  }, [successTimer]);

  if (isExpired) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-card p-5 text-center">
        <p className="text-loss font-bold">Tips are now closed</p>
        <p className="text-sm text-slate-500 mt-1">The cutoff has passed. Refresh the page to see all tips.</p>
      </div>
    );
  }

  const selectClasses =
    "w-full bg-white border border-surface-muted rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30";
  const inputClasses =
    "w-full bg-white border border-surface-muted rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30";

  // Can we add more lines? Each-way uses 2 API slots
  const apiLineCount = getApiLineCount();
  const canAddLine = apiLineCount < 4;

  // Per-line validation errors for inline display
  function getLineErrors(index: number): string[] {
    const errs: string[] = [];
    const l = lines[index];
    if (!l.runnerId && (l.amount > 0 || lines.length > 1 || lines.some((ll) => ll.runnerId)))
      errs.push("Select a runner");
    if ((!l.amount || l.amount <= 0) && (l.runnerId || lines.length > 1))
      errs.push("Enter an amount");
    return errs;
  }

  return (
    <div className="bg-white rounded-card p-5 border border-surface-muted shadow-card">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold text-gold uppercase tracking-wide">
          {existingTip ? "Edit Your Tips" : "Submit Tips"}
        </h3>
        <div className="text-right">
          {minutesLeft !== null && minutesLeft <= 60 && (
            <p className={`text-xs font-semibold ${minutesLeft <= 15 ? "text-loss" : "text-orange-500"}`}>
              {minutesLeft}min left
            </p>
          )}
          <p className="text-sm text-slate-700">
            Budget: <span className="font-bold text-slate-900">$100</span>
          </p>
          <p
            className={`text-xs ${
              Math.abs(remaining) < 0.01
                ? "text-profit"
                : remaining < 0
                  ? "text-loss"
                  : "text-slate-500"
            }`}
          >
            Remaining: ${remaining.toFixed(0)}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-loss rounded-lg px-4 py-2 mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {lines.map((line, i) => {
          const usedIds = getUsedRunnerIds(i);
          const lineErrors = getLineErrors(i);
          return (
            <div
              key={i}
              className="bg-surface rounded-lg p-4 border border-surface-muted"
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs text-slate-500 font-medium">
                  BET {i + 1}
                </span>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="text-xs text-loss hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>

              {/* Horse selection */}
              <div className="mb-3">
                <label className="block text-xs text-slate-500 mb-1">
                  Horse
                </label>
                <select
                  value={line.runnerId}
                  onChange={(e) =>
                    updateLine(i, { runnerId: e.target.value })
                  }
                  className={`${selectClasses} ${!line.runnerId && lineErrors.length > 0 ? "border-red-300" : ""}`}
                >
                  <option value="">Select horse...</option>
                  {runners
                    .filter(
                      (r) => !usedIds.has(r.id) || r.id === line.runnerId
                    )
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.runnerNumber ? `${r.runnerNumber}. ` : ""}
                        {r.name}
                      </option>
                    ))}
                </select>
                {!line.runnerId && lineErrors.includes("Select a runner") && (
                  <p className="text-xs text-loss mt-1">Select a runner for this bet</p>
                )}
              </div>

              {/* Bet type + Amount */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Type
                  </label>
                  <select
                    value={line.betType}
                    onChange={(e) => {
                      const newType = e.target.value as "win" | "place" | "eachway";
                      // If switching to each-way, check we have room
                      if (newType === "eachway" && line.betType !== "eachway") {
                        const currentApiCount = getApiLineCount();
                        // Current line is 1 API slot, each-way needs 2, so net +1
                        if (currentApiCount + 1 > 4) return;
                      }
                      updateLine(i, { betType: newType });
                    }}
                    className={selectClasses}
                  >
                    <option value="win">Win</option>
                    <option value="place">Place</option>
                    <option value="eachway" disabled={
                      line.betType !== "eachway" && apiLineCount + 1 > 4
                    }>
                      Each Way
                    </option>
                  </select>
                  {line.betType === "eachway" && (
                    <p className="text-xs text-slate-400 mt-1">
                      Win + Place at equal stakes
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    {line.betType === "eachway" ? "Amount per leg ($)" : "Amount ($)"}
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
                    className={`${inputClasses} ${(!line.amount || line.amount <= 0) && lineErrors.length > 0 ? "border-red-300" : ""}`}
                    placeholder="0"
                  />
                  {line.betType === "eachway" && line.amount > 0 && (
                    <p className="text-xs text-slate-400 mt-1">
                      Total: ${(line.amount * 2).toFixed(0)} (${line.amount} W + ${line.amount} P)
                    </p>
                  )}
                  {(!line.amount || line.amount <= 0) && lineErrors.includes("Enter an amount") && (
                    <p className="text-xs text-loss mt-1">Enter an amount for this bet</p>
                  )}
                </div>
              </div>

              {/* Backup horse */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Backup (if scratched)
                </label>
                <select
                  value={line.backupRunnerId || ""}
                  onChange={(e) =>
                    updateLine(i, {
                      backupRunnerId: e.target.value || undefined,
                    })
                  }
                  className={selectClasses}
                >
                  <option value="">No backup</option>
                  {runners
                    .filter((r) => r.id !== line.runnerId)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.runnerNumber ? `${r.runnerNumber}. ` : ""}
                        {r.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          );
        })}

        {/* Add bet button */}
        {canAddLine && (
          <button
            type="button"
            onClick={addLine}
            className="w-full py-2 border border-dashed border-surface-muted rounded-lg text-sm text-slate-500 hover:text-gold hover:border-gold/30 transition"
          >
            + Add Another Bet ({apiLineCount}/4 slots used)
          </button>
        )}

        {/* Summary */}
        <div className="bg-surface rounded-lg p-4 border border-surface-muted">
          <h4 className="text-xs text-slate-500 mb-2 uppercase">Summary</h4>
          {lines
            .filter((l) => l.runnerId && l.amount > 0)
            .map((l, i) => {
              const runner = runners.find((r) => r.id === l.runnerId);
              if (l.betType === "eachway") {
                return (
                  <div key={i} className="text-sm text-slate-700">
                    <div className="flex justify-between">
                      <span>
                        ${l.amount} WIN {runner?.name || "..."}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>
                        ${l.amount} PLACE {runner?.name || "..."}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-1">Each Way = ${(l.amount * 2).toFixed(0)} total</p>
                  </div>
                );
              }
              return (
                <div key={i} className="flex justify-between text-sm text-slate-700">
                  <span>
                    ${l.amount} {l.betType.toUpperCase()}{" "}
                    {runner?.name || "..."}
                  </span>
                </div>
              );
            })}
          <div className="mt-2 pt-2 border-t border-surface-muted flex justify-between text-sm font-bold">
            <span className="text-slate-700">Total</span>
            <span
              className={
                Math.abs(totalAmount - 100) < 0.01
                  ? "text-profit"
                  : "text-loss"
              }
            >
              ${totalAmount.toFixed(0)}{" "}
              {Math.abs(totalAmount - 100) < 0.01 ? "\u2713" : ""}
            </span>
          </div>
        </div>

        {/* Validation summary near submit */}
        {validationErrors.length > 0 && !success && (
          <div className="space-y-1">
            {validationErrors.map((err, i) => (
              <p key={i} className={`text-xs ${err.includes("must equal") ? "text-loss font-medium" : "text-slate-500"}`}>
                {err}
              </p>
            ))}
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3">
          {success ? (
            <button
              type="submit"
              disabled={!isValid || loading}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
            >
              {loading ? "Submitting..." : "\u2713 Tips Confirmed"}
            </button>
          ) : (
            <button
              type="submit"
              disabled={!isValid || loading}
              className="flex-1 bg-gold hover:bg-gold-dark text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
            >
              {loading
                ? "Submitting..."
                : existingTip
                  ? "Update Tips"
                  : "Submit Tips"}
            </button>
          )}
          {(existingTip || success) && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="px-4 bg-red-50 text-loss rounded-lg hover:bg-red-100 transition disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>

        {success && (
          <p className="text-center text-sm text-profit font-medium">
            Tips saved! You can still edit and resubmit before cutoff.
          </p>
        )}
      </form>
    </div>
  );
}
