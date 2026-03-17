"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Round {
  id: string;
  number: number;
  name: string;
  raceDate: string;
  races: Array<{
    id: string;
    name: string;
    venue: string;
    distance: number;
    grade: string;
    status: string;
    raceTime: string;
    raceNumber: number;
    runners: Array<{ id: string; name: string; isScratched: boolean }>;
  }>;
}

export function RaceManager({ rounds }: { rounds: Round[] }) {
  const router = useRouter();
  const [expandedRound, setExpandedRound] = useState<string | null>(null);
  const [addingRace, setAddingRace] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // New race form state
  const [newRace, setNewRace] = useState({
    name: "",
    venue: "",
    distance: "",
    raceTime: "",
    raceNumber: "",
    grade: "G1",
    raceType: "",
    prizePool: "",
  });

  async function handleAddRace(roundId: string) {
    if (!newRace.name || !newRace.venue || !newRace.distance || !newRace.raceTime) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/races", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId, ...newRace }),
      });
      if (res.ok) {
        setNewRace({ name: "", venue: "", distance: "", raceTime: "", raceNumber: "", grade: "G1", raceType: "", prizePool: "" });
        setAddingRace(null);
        router.refresh();
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function handleStatusChange(raceId: string, status: string) {
    await fetch("/api/admin/races", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raceId, status }),
    });
    router.refresh();
  }

  async function handleDeleteRace(raceId: string) {
    if (!confirm("Delete this race? This cannot be undone.")) return;
    await fetch("/api/admin/races", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raceId }),
    });
    router.refresh();
  }

  async function handleScratch(runnerId: string, isScratched: boolean) {
    await fetch("/api/admin/runners", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runnerId, isScratched }),
    });
    router.refresh();
  }

  const inputClasses =
    "bg-white border border-surface-muted rounded px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30";

  return (
    <div className="space-y-3">
      {rounds.map((round) => (
        <div key={round.id} className="bg-white rounded-card border border-surface-muted overflow-hidden">
          <button
            onClick={() => setExpandedRound(expandedRound === round.id ? null : round.id)}
            className="w-full flex justify-between items-center p-4 text-left hover:bg-surface-hover transition"
          >
            <div>
              <span className="font-semibold text-slate-900">{round.name}</span>
              <span className="text-xs text-slate-400 ml-2">
                {new Date(round.raceDate).toLocaleDateString("en-AU", { weekday: "short", month: "short", day: "numeric" })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{round.races.length} races</span>
              <span className="text-slate-400">{expandedRound === round.id ? "▲" : "▼"}</span>
            </div>
          </button>

          {expandedRound === round.id && (
            <div className="border-t border-surface-muted p-4 space-y-3">
              {round.races.map((race) => (
                <div key={race.id} className="bg-surface rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <a href={`/races/${race.id}`} className="font-medium text-gold hover:underline">
                        {race.name}
                      </a>
                      <p className="text-xs text-slate-500">
                        {race.venue} &middot; {race.distance}m &middot; {race.grade}
                        {race.raceNumber > 0 && ` &middot; R${race.raceNumber}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={race.status}
                        onChange={(e) => handleStatusChange(race.id, e.target.value)}
                        className="text-xs bg-white border border-surface-muted rounded px-2 py-1 text-slate-700 focus:outline-none focus:border-gold"
                      >
                        <option value="upcoming">Upcoming</option>
                        <option value="open">Open</option>
                        <option value="closed">Closed</option>
                        <option value="final">Final</option>
                        <option value="abandoned">Abandoned</option>
                      </select>
                      <button
                        onClick={() => handleDeleteRace(race.id)}
                        className="text-xs text-loss hover:text-red-700"
                        title="Delete race"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Runner count + scratch controls */}
                  {race.runners.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {race.runners.map((runner) => (
                        <button
                          key={runner.id}
                          onClick={() => handleScratch(runner.id, !runner.isScratched)}
                          className={`text-xs px-2 py-0.5 rounded ${
                            runner.isScratched
                              ? "bg-red-50 text-loss line-through"
                              : "bg-surface-hover text-slate-600 hover:bg-surface-muted"
                          }`}
                          title={runner.isScratched ? "Click to reinstate" : "Click to scratch"}
                        >
                          {runner.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {race.runners.length === 0 && (
                    <p className="text-xs text-slate-400 mt-1">No runners yet</p>
                  )}
                </div>
              ))}

              {/* Add Race Form */}
              {addingRace === round.id ? (
                <div className="bg-surface rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gold">Add Race</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      placeholder="Race Name"
                      value={newRace.name}
                      onChange={(e) => setNewRace({ ...newRace, name: e.target.value })}
                      className={`${inputClasses} col-span-2`}
                    />
                    <input
                      placeholder="Venue"
                      value={newRace.venue}
                      onChange={(e) => setNewRace({ ...newRace, venue: e.target.value })}
                      className={inputClasses}
                    />
                    <input
                      placeholder="Distance (m)"
                      type="number"
                      value={newRace.distance}
                      onChange={(e) => setNewRace({ ...newRace, distance: e.target.value })}
                      className={inputClasses}
                    />
                    <input
                      placeholder="Race Time"
                      type="datetime-local"
                      value={newRace.raceTime}
                      onChange={(e) => setNewRace({ ...newRace, raceTime: e.target.value })}
                      className={inputClasses}
                    />
                    <input
                      placeholder="Race #"
                      type="number"
                      value={newRace.raceNumber}
                      onChange={(e) => setNewRace({ ...newRace, raceNumber: e.target.value })}
                      className={inputClasses}
                    />
                    <select
                      value={newRace.grade}
                      onChange={(e) => setNewRace({ ...newRace, grade: e.target.value })}
                      className={inputClasses}
                    >
                      <option value="G1">Group 1</option>
                      <option value="G2">Group 2</option>
                      <option value="G3">Group 3</option>
                      <option value="Listed">Listed</option>
                    </select>
                    <input
                      placeholder="Race Type (e.g. WFA)"
                      value={newRace.raceType}
                      onChange={(e) => setNewRace({ ...newRace, raceType: e.target.value })}
                      className={inputClasses}
                    />
                    <input
                      placeholder="Prize Pool"
                      value={newRace.prizePool}
                      onChange={(e) => setNewRace({ ...newRace, prizePool: e.target.value })}
                      className={`${inputClasses} col-span-2`}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAddRace(round.id)}
                      disabled={loading}
                      className="bg-gold hover:bg-gold-dark text-white font-bold text-sm px-4 py-2 rounded-lg transition disabled:opacity-50"
                    >
                      {loading ? "Adding..." : "Add Race"}
                    </button>
                    <button
                      onClick={() => setAddingRace(null)}
                      className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingRace(round.id)}
                  className="w-full text-sm text-gold hover:text-gold-dark border border-dashed border-surface-muted rounded-lg py-2 hover:border-gold/30 transition"
                >
                  + Add Race to Round {round.number}
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
