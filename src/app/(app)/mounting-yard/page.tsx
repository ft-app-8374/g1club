import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVenueCutoffs } from "@/lib/cutoff";

export default async function MountingYardPage() {
  const session = await getServerSession(authOptions);
  const currentUserId = session?.user.id;

  // Find the active carnival with all rounds, races, tips, runners
  const carnival = await prisma.carnival.findFirst({
    where: { status: { in: ["active", "upcoming"] } },
    include: {
      rounds: {
        include: {
          races: {
            include: {
              runners: true,
              tips: {
                include: {
                  user: { select: { id: true, username: true } },
                  tipLines: {
                    include: {
                      runner: { select: { id: true, name: true, runnerNumber: true, isScratched: true } },
                      backupRunner: { select: { id: true, name: true, runnerNumber: true } },
                      effectiveRunner: { select: { id: true, name: true, runnerNumber: true } },
                    },
                  },
                },
              },
            },
            orderBy: { raceNumber: "asc" },
          },
        },
        orderBy: { number: "asc" },
      },
    },
  });

  if (!carnival) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold text-slate-900 mb-2">The Mounting Yard</h2>
        <p className="text-slate-500">No active carnival. Check back when the season starts.</p>
      </div>
    );
  }

  // Build leaderboard from ledger
  const ledgerEntries = await prisma.ledger.findMany({
    include: { user: { select: { id: true, username: true } } },
  });

  const userPnL = new Map<string, { username: string; userId: string; profit: number; races: number }>();
  for (const entry of ledgerEntries) {
    const existing = userPnL.get(entry.userId);
    if (existing) {
      existing.profit += entry.profit;
      existing.races += 1;
    } else {
      userPnL.set(entry.userId, {
        username: entry.user.username,
        userId: entry.userId,
        profit: entry.profit,
        races: 1,
      });
    }
  }

  // Get all users who have tipped (including those with no settled races yet)
  const allTippingUsers = await prisma.user.findMany({
    where: {
      tips: { some: { race: { round: { carnivalId: carnival.id } } } },
    },
    select: { id: true, username: true },
  });

  // Ensure every tipping user is in the map
  for (const user of allTippingUsers) {
    if (!userPnL.has(user.id)) {
      userPnL.set(user.id, {
        username: user.username,
        userId: user.id,
        profit: 0,
        races: 0,
      });
    }
  }

  const leaderboard = Array.from(userPnL.values()).sort((a, b) => b.profit - a.profit);

  const now = new Date();

  // Find the most recent round(s) that have at least one venue past cutoff
  // We look at current weekend's races — rounds whose cutoff has passed
  const lockedRounds: typeof carnival.rounds = [];
  let nextCutoff: { venue: string; time: Date } | null = null;

  for (const round of carnival.rounds) {
    const cutoffs = await getVenueCutoffs(round.id);
    let anyLocked = false;
    for (const [venue, cutoffTime] of Array.from(cutoffs.entries())) {
      if (cutoffTime <= now) {
        anyLocked = true;
      } else {
        // Track the soonest upcoming cutoff
        if (!nextCutoff || cutoffTime < nextCutoff.time) {
          nextCutoff = { venue, time: cutoffTime };
        }
      }
    }
    if (anyLocked) {
      lockedRounds.push(round);
    }
  }

  const medals = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];

  // Pre-lockout: no rounds have had any cutoff pass yet
  if (lockedRounds.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">The Mounting Yard</h2>
          <p className="text-sm text-slate-500 mt-0.5">See what the field is playing</p>
        </div>

        <div className="bg-white rounded-card p-8 border border-surface-muted shadow-card text-center">
          <p className="text-3xl mb-3">🔒</p>
          <p className="text-slate-700 font-medium mb-2">Tips will be revealed after lockout</p>
          {nextCutoff && (
            <p className="text-sm text-slate-500">
              Next lockout:{" "}
              <span className="font-semibold text-gold">
                {nextCutoff.venue} &mdash;{" "}
                {nextCutoff.time.toLocaleString("en-AU", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "Australia/Sydney",
                })}
              </span>
            </p>
          )}
        </div>
      </div>
    );
  }

  // Post-lockout: show everyone's tips grouped by leaderboard rank
  // Collect all races from locked rounds
  const lockedRaces = lockedRounds.flatMap((r) => r.races);

  // Build a lookup: userId -> raceId -> tip (with lines)
  type TipWithLines = (typeof lockedRaces)[number]["tips"][number];
  const tipsByUser = new Map<string, Map<string, TipWithLines>>();

  for (const race of lockedRaces) {
    for (const tip of race.tips) {
      if (!tipsByUser.has(tip.userId)) {
        tipsByUser.set(tip.userId, new Map());
      }
      tipsByUser.get(tip.userId)!.set(race.id, tip);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">The Mounting Yard</h2>
        <p className="text-sm text-slate-500 mt-0.5">See what the field is playing</p>
      </div>

      {/* Table: races as columns, punters as rows */}
      <div className="bg-white rounded-card border border-surface-muted shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="bg-surface border-b border-surface-muted">
                <th className="text-left px-3 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wide sticky left-0 bg-surface z-10 min-w-[120px]">
                  Punter
                </th>
                {lockedRaces.map((race) => (
                  <th key={race.id} className="text-left px-3 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wide min-w-[150px]">
                    <div>R{race.raceNumber} {race.name}</div>
                    <div className="font-normal text-slate-400 normal-case">{race.venue} · {race.distance}m</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-muted">
              {leaderboard.map((entry, i) => {
                const isMe = entry.userId === currentUserId;
                const userTips = tipsByUser.get(entry.userId);

                return (
                  <tr key={entry.userId} className={isMe ? "bg-gold-accent/50" : ""}>
                    <td className={`px-3 py-2.5 sticky left-0 z-10 ${isMe ? "bg-gold-accent" : "bg-white"}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm w-6 text-center">
                          {i < 3
                            ? medals[i]
                            : i === leaderboard.length - 1
                              ? "\u{1F944}"
                              : `${i + 1}`}
                        </span>
                        <div>
                          <span className={`text-sm font-semibold ${isMe ? "text-gold" : "text-slate-900"}`}>
                            {entry.username}
                          </span>
                          <div className={`text-[10px] font-bold ${entry.profit >= 0 ? "text-profit" : "text-loss"}`}>
                            {entry.profit >= 0 ? "+" : ""}${entry.profit.toFixed(0)}
                          </div>
                        </div>
                      </div>
                    </td>
                    {lockedRaces.map((race) => {
                      const tip = userTips?.get(race.id);

                      return (
                        <td key={race.id} className="px-3 py-2.5 align-top">
                          {!tip || tip.tipLines.length === 0 ? (
                            <span className="text-xs text-loss">No tip</span>
                          ) : (
                            <div className="space-y-0.5">
                              {tip.tipLines.map((line) => {
                                const displayRunner =
                                  line.isBackupActive && line.effectiveRunner
                                    ? line.effectiveRunner
                                    : line.runner;

                                return (
                                  <div key={line.id} className="text-xs">
                                    <span className="font-semibold text-slate-900">{displayRunner.name}</span>
                                    {" "}
                                    <span className={`font-bold ${line.betType === "win" ? "text-gold" : "text-slate-400"}`}>
                                      {line.betType === "win" ? "W" : "P"}
                                    </span>
                                    {" "}
                                    <span className="text-slate-500">${line.amount.toFixed(0)}</span>
                                    {line.runner.isScratched && !line.isBackupActive && (
                                      <span className="text-loss ml-1">SCR</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upcoming cutoff notice */}
      {nextCutoff && (
        <div className="bg-white rounded-card p-4 border border-surface-muted shadow-card text-center">
          <p className="text-sm text-slate-500">
            Next lockout:{" "}
            <span className="font-semibold text-gold">
              {nextCutoff.venue} &mdash;{" "}
              {nextCutoff.time.toLocaleString("en-AU", {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
                timeZone: "Australia/Sydney",
              })}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
