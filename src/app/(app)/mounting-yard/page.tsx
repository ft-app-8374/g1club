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

      {/* Round header(s) */}
      {lockedRounds.map((round) => (
        <div key={round.id} className="flex items-center gap-2">
          <h3 className="text-sm text-gold font-semibold uppercase tracking-wide">
            {new Date(round.raceDate).toLocaleDateString("en-AU", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}{" "}
            &middot; Round {round.number}
          </h3>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
            {lockedRaces.length} {lockedRaces.length === 1 ? "race" : "races"}
          </span>
        </div>
      ))}

      {/* Each user's tips, ordered by leaderboard rank */}
      {leaderboard.map((entry, i) => {
        const isMe = entry.userId === currentUserId;
        const userTips = tipsByUser.get(entry.userId);

        return (
          <div
            key={entry.userId}
            className={`bg-white rounded-card border border-surface-muted shadow-card overflow-hidden ${
              isMe ? "ring-2 ring-gold/30" : ""
            }`}
          >
            {/* User header */}
            <div
              className={`flex items-center justify-between px-4 py-3 border-b border-surface-muted ${
                isMe ? "bg-gold-accent" : "bg-surface"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg w-8 text-center">
                  {i < 3
                    ? medals[i]
                    : i === leaderboard.length - 1
                      ? "\u{1F944}"
                      : `${i + 1}`}
                </span>
                <span
                  className={`font-semibold ${isMe ? "text-gold" : "text-slate-900"}`}
                >
                  {entry.username}
                </span>
              </div>
              <span
                className={`font-bold text-sm ${
                  entry.profit >= 0 ? "text-profit" : "text-loss"
                }`}
              >
                {entry.profit >= 0 ? "+" : ""}${entry.profit.toFixed(0)}
              </span>
            </div>

            {/* Tips for each race */}
            <div className="divide-y divide-surface-muted">
              {lockedRaces.map((race) => {
                const tip = userTips?.get(race.id);

                return (
                  <div key={race.id} className="px-4 py-3">
                    <p className="text-xs text-slate-400 mb-1.5">
                      {race.venue} R{race.raceNumber} &mdash; {race.name}
                    </p>

                    {!tip || tip.tipLines.length === 0 ? (
                      <p className="text-sm text-loss font-medium">No tip</p>
                    ) : (
                      <div className="space-y-1">
                        {tip.tipLines.map((line) => {
                          const displayRunner =
                            line.isBackupActive && line.effectiveRunner
                              ? line.effectiveRunner
                              : line.runner;
                          const betLabel =
                            line.betType === "win" ? "W" : "P";

                          return (
                            <div key={line.id} className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900">
                                {displayRunner.name}
                              </span>
                              <span
                                className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                  line.betType === "win"
                                    ? "bg-gold-accent text-gold"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {betLabel}
                              </span>
                              <span className="text-xs text-slate-500">
                                ${line.amount.toFixed(0)}
                              </span>
                              {line.isBackupActive && line.effectiveRunner && (
                                <span className="text-[10px] text-slate-400">
                                  (was {line.runner.name})
                                </span>
                              )}
                              {line.backupRunner && !line.isBackupActive && (
                                <span className="text-[10px] text-slate-400">
                                  B/U: {line.backupRunner.name}
                                </span>
                              )}
                              {line.runner.isScratched && !line.isBackupActive && (
                                <span className="text-[10px] text-loss">
                                  SCR
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

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
