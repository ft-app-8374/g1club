"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Runner {
  id: string;
  name: string;
  barrier: number | null;
  runnerNumber: number;
  isScratched: boolean;
}

interface TipLineData {
  id: string;
  runnerId: string;
  backupRunnerId: string | null;
  betType: string;
  amount: number;
  runner: { id: string; name: string; runnerNumber: number };
  backupRunner: { id: string; name: string; runnerNumber: number } | null;
}

interface UserTip {
  id: string;
  raceId: string;
  raceName: string;
  raceVenue: string;
  raceStatus: string;
  cutoffPassed: boolean;
  tipLines: TipLineData[];
  runners: Runner[];
}

interface Member {
  id: string;
  username: string;
  email: string;
  role: string;
  isFinancial: boolean;
  tips: UserTip[];
}

interface EditLine {
  runnerId: string;
  backupRunnerId: string | undefined;
  betType: "win" | "place";
  amount: number;
}

export function MemberTips({ members }: { members: Member[] }) {
  const router = useRouter();
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [editingTip, setEditingTip] = useState<string | null>(null); // tipId or "new:raceId:userId"
  const [editLines, setEditLines] = useState<EditLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function startEdit(tip: UserTip, userId: string) {
    if (tip.tipLines.length > 0) {
      setEditingTip(tip.id);
      setEditLines(
        tip.tipLines.map((tl) => ({
          runnerId: tl.runnerId,
          backupRunnerId: tl.backupRunnerId || undefined,
          betType: tl.betType as "win" | "place",
          amount: tl.amount,
        }))
      );
    } else {
      setEditingTip(`new:${tip.raceId}:${userId}`);
      setEditLines([{ runnerId: "", backupRunnerId: undefined, betType: "win", amount: 0 }]);
    }
    setMessage("");
  }

  function cancelEdit() {
    setEditingTip(null);
    setEditLines([]);
    setMessage("");
  }

  function updateLine(index: number, update: Partial<EditLine>) {
    setEditLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, ...update } : l))
    );
  }

  function addLine() {
    if (editLines.length >= 4) return;
    setEditLines((prev) => [
      ...prev,
      { runnerId: "", backupRunnerId: undefined, betType: "win", amount: 0 },
    ]);
  }

  function removeLine(index: number) {
    if (editLines.length <= 1) return;
    setEditLines((prev) => prev.filter((_, i) => i !== index));
  }

  function getUsedRunnerIds(excludeIndex: number): Set<string> {
    return new Set(
      editLines.filter((_, i) => i !== excludeIndex).map((l) => l.runnerId)
    );
  }

  async function handleSave(tip: UserTip, userId: string) {
    const totalAmount = editLines.reduce((sum, l) => sum + (l.amount || 0), 0);
    if (Math.abs(totalAmount - 100) > 0.01) {
      setMessage("Bets must total exactly $100");
      return;
    }
    if (!editLines.every((l) => l.runnerId && l.amount > 0)) {
      setMessage("Each line needs a horse and amount");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/edit-tip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          raceId: tip.raceId,
          lines: editLines.map((l) => ({
            runnerId: l.runnerId,
            backupRunnerId: l.backupRunnerId || null,
            betType: l.betType,
            amount: l.amount,
          })),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage("Saved");
        setEditingTip(null);
        setEditLines([]);
        router.refresh();
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage(`Error: ${error}`);
    }
    setLoading(false);
  }

  const totalAmount = editLines.reduce((sum, l) => sum + (l.amount || 0), 0);
  const isValid =
    Math.abs(totalAmount - 100) < 0.01 &&
    editLines.every((l) => l.runnerId && l.amount > 0) &&
    editLines.length <= 4;

  const selectClasses =
    "w-full bg-white border border-surface-muted rounded px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30";

  return (
    <div className="space-y-2">
      {members.map((member) => (
        <div key={member.id} className="bg-surface rounded-lg overflow-hidden">
          <button
            onClick={() =>
              setExpandedUser(expandedUser === member.id ? null : member.id)
            }
            className="w-full flex justify-between items-center px-3 py-2 text-left hover:bg-surface-hover transition"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-slate-900">
                {member.username}
              </span>
              {member.role === "admin" && (
                <span className="text-xs bg-gold-accent text-gold px-1.5 py-0.5 rounded font-medium">
                  Admin
                </span>
              )}
              <span
                className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  member.isFinancial
                    ? "bg-green-50 text-profit"
                    : "bg-red-50 text-loss"
                }`}
              >
                {member.isFinancial ? "Paid" : "Unpaid"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">
                {member.tips.filter((t) => t.tipLines.length > 0).length} tips
              </span>
              <span className="text-slate-400 text-xs">
                {expandedUser === member.id ? "▲" : "▼"}
              </span>
            </div>
          </button>

          {expandedUser === member.id && (
            <div className="border-t border-surface-muted px-3 py-3 space-y-3">
              {member.tips.length === 0 ? (
                <p className="text-xs text-slate-400">No races in this carnival</p>
              ) : (
                member.tips.map((tip) => {
                  const isEditing = editingTip === tip.id || editingTip === `new:${tip.raceId}:${member.id}`;
                  const activeRunners = tip.runners.filter((r) => !r.isScratched);

                  return (
                    <div key={tip.raceId} className="bg-white rounded-lg p-3 border border-surface-muted">
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <span className="text-sm font-medium text-slate-900">
                            {tip.raceName}
                          </span>
                          <span className="text-xs text-slate-400 ml-2">
                            {tip.raceVenue}
                          </span>
                          {tip.cutoffPassed && (
                            <span className="text-xs text-orange-500 ml-2">
                              (cutoff passed)
                            </span>
                          )}
                        </div>
                        {!isEditing && (
                          <button
                            onClick={() => startEdit(tip, member.id)}
                            className="text-xs text-gold hover:text-gold-dark font-medium"
                          >
                            {tip.tipLines.length > 0 ? "Edit" : "+ Add tip"}
                          </button>
                        )}
                      </div>

                      {!isEditing && tip.tipLines.length > 0 && (
                        <div className="space-y-1">
                          {tip.tipLines.map((tl) => (
                            <div
                              key={tl.id}
                              className="flex justify-between text-sm text-slate-700"
                            >
                              <span>
                                ${tl.amount} {tl.betType.toUpperCase()}{" "}
                                {tl.runner.runnerNumber ? `${tl.runner.runnerNumber}. ` : ""}
                                {tl.runner.name}
                                {tl.backupRunner && (
                                  <span className="text-xs text-slate-400">
                                    {" "}(backup: {tl.backupRunner.name})
                                  </span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {!isEditing && tip.tipLines.length === 0 && (
                        <p className="text-xs text-slate-400">No tips submitted</p>
                      )}

                      {isEditing && (
                        <div className="space-y-3 mt-2">
                          {editLines.map((line, i) => {
                            const usedIds = getUsedRunnerIds(i);
                            return (
                              <div
                                key={i}
                                className="bg-surface rounded-lg p-3 border border-surface-muted"
                              >
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-xs text-slate-500 font-medium">
                                    BET {i + 1}
                                  </span>
                                  {editLines.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => removeLine(i)}
                                      className="text-xs text-loss hover:text-red-700"
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>

                                <div className="mb-2">
                                  <select
                                    value={line.runnerId}
                                    onChange={(e) =>
                                      updateLine(i, { runnerId: e.target.value })
                                    }
                                    className={selectClasses}
                                  >
                                    <option value="">Select horse...</option>
                                    {activeRunners
                                      .filter(
                                        (r) =>
                                          !usedIds.has(r.id) ||
                                          r.id === line.runnerId
                                      )
                                      .map((r) => (
                                        <option key={r.id} value={r.id}>
                                          {r.runnerNumber
                                            ? `${r.runnerNumber}. `
                                            : ""}
                                          {r.name}
                                        </option>
                                      ))}
                                  </select>
                                </div>

                                <div className="grid grid-cols-2 gap-2 mb-2">
                                  <select
                                    value={line.betType}
                                    onChange={(e) =>
                                      updateLine(i, {
                                        betType: e.target.value as
                                          | "win"
                                          | "place",
                                      })
                                    }
                                    className={selectClasses}
                                  >
                                    <option value="win">Win</option>
                                    <option value="place">Place</option>
                                  </select>
                                  <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    step="1"
                                    value={line.amount || ""}
                                    onChange={(e) =>
                                      updateLine(i, {
                                        amount:
                                          parseFloat(e.target.value) || 0,
                                      })
                                    }
                                    className={selectClasses}
                                    placeholder="Amount $"
                                  />
                                </div>

                                <select
                                  value={line.backupRunnerId || ""}
                                  onChange={(e) =>
                                    updateLine(i, {
                                      backupRunnerId:
                                        e.target.value || undefined,
                                    })
                                  }
                                  className={selectClasses}
                                >
                                  <option value="">No backup</option>
                                  {activeRunners
                                    .filter((r) => r.id !== line.runnerId)
                                    .map((r) => (
                                      <option key={r.id} value={r.id}>
                                        {r.runnerNumber
                                          ? `${r.runnerNumber}. `
                                          : ""}
                                        {r.name}
                                      </option>
                                    ))}
                                </select>
                              </div>
                            );
                          })}

                          {editLines.length < 4 && (
                            <button
                              type="button"
                              onClick={addLine}
                              className="w-full py-1.5 border border-dashed border-surface-muted rounded text-xs text-slate-500 hover:text-gold hover:border-gold/30 transition"
                            >
                              + Add Bet ({editLines.length}/4)
                            </button>
                          )}

                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">
                              Total: ${totalAmount.toFixed(0)}/100
                            </span>
                            {message && (
                              <span
                                className={`text-xs ${
                                  message.startsWith("Error")
                                    ? "text-loss"
                                    : message === "Saved"
                                      ? "text-profit"
                                      : "text-loss"
                                }`}
                              >
                                {message}
                              </span>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSave(tip, member.id)}
                              disabled={!isValid || loading}
                              className="flex-1 bg-gold hover:bg-gold-dark text-white font-bold text-sm px-3 py-2 rounded-lg transition disabled:opacity-50"
                            >
                              {loading ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="text-sm text-slate-500 hover:text-slate-700 px-3 py-2"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
