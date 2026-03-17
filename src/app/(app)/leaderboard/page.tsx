import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function LeaderboardPage() {
  const session = await getServerSession(authOptions);

  // Current season P&L from ledger
  const entries = await prisma.ledger.findMany({
    include: { user: { select: { id: true, username: true } } },
  });

  const userMap = new Map<
    string,
    { username: string; userId: string; profit: number; races: number }
  >();

  for (const entry of entries) {
    const existing = userMap.get(entry.userId);
    if (existing) {
      existing.profit += entry.profit;
      existing.races += 1;
    } else {
      userMap.set(entry.userId, {
        username: entry.user.username,
        userId: entry.userId,
        profit: entry.profit,
        races: 1,
      });
    }
  }

  const currentLeaderboard = Array.from(userMap.values()).sort(
    (a, b) => b.profit - a.profit
  );

  // Lifetime P&L from SeasonResult (historical data)
  const lifetimeResults = await prisma.seasonResult.groupBy({
    by: ["canonicalName", "userId"],
    _sum: { totalPnl: true },
    _count: true,
    orderBy: { _sum: { totalPnl: "desc" } },
  });

  // Also get per-season breakdown for users with accounts
  const seasonDetails = await prisma.seasonResult.findMany({
    where: { userId: { not: null } },
    select: { canonicalName: true, userId: true, year: true, totalPnl: true, rank: true },
    orderBy: { year: "desc" },
  });

  // Group season details by canonical name
  const seasonsByName = new Map<string, Array<{ year: number; pnl: number; rank: number }>>();
  for (const s of seasonDetails) {
    const existing = seasonsByName.get(s.canonicalName) || [];
    existing.push({ year: s.year, pnl: s.totalPnl, rank: s.rank });
    seasonsByName.set(s.canonicalName, existing);
  }

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-6">
      {/* Current Season */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-3">Current Season</h2>
        {currentLeaderboard.length === 0 ? (
          <div className="bg-white rounded-card p-6 border border-surface-muted shadow-card text-center">
            <p className="text-slate-500">
              No results yet. The leaderboard will populate once races are settled.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-card border border-surface-muted shadow-card overflow-hidden">
            {currentLeaderboard.map((entry, i) => {
              const isMe = entry.userId === session?.user.id;
              const isLast = i === currentLeaderboard.length - 1;
              return (
                <div
                  key={entry.userId}
                  className={`flex items-center justify-between px-4 py-3 ${
                    !isLast ? "border-b border-surface-muted" : ""
                  } ${isMe ? "bg-gold-accent" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg w-8 text-center">
                      {i < 3 ? medals[i] : i === currentLeaderboard.length - 1 ? "🥄" : `${i + 1}`}
                    </span>
                    <div>
                      <span className={`font-semibold ${isMe ? "text-gold" : "text-slate-900"}`}>
                        {entry.username}
                      </span>
                      <span className="text-xs text-slate-400 ml-2">
                        {entry.races} races
                      </span>
                    </div>
                  </div>
                  <span className={`font-bold ${entry.profit >= 0 ? "text-profit" : "text-loss"}`}>
                    {entry.profit >= 0 ? "+" : ""}${entry.profit.toFixed(0)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lifetime P&L */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-3">Lifetime P&L</h2>
        <div className="bg-white rounded-card border border-surface-muted shadow-card overflow-hidden">
          {lifetimeResults.length === 0 ? (
            <div className="p-6 text-center text-slate-500">No historical data yet.</div>
          ) : (
            lifetimeResults.map((entry, i) => {
              const pnl = entry._sum.totalPnl || 0;
              const isMe = entry.userId === session?.user.id;
              const isLast = i === lifetimeResults.length - 1;
              const seasons = seasonsByName.get(entry.canonicalName) || [];
              return (
                <div key={entry.canonicalName + i}>
                  <div
                    className={`flex items-center justify-between px-4 py-3 ${
                      !isLast ? "border-b border-surface-muted" : ""
                    } ${isMe ? "bg-gold-accent" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg w-8 text-center">
                        {i < 3 ? medals[i] : `${i + 1}`}
                      </span>
                      <div>
                        <span className={`font-semibold ${isMe ? "text-gold" : "text-slate-900"}`}>
                          {entry.canonicalName}
                        </span>
                        <span className="text-xs text-slate-400 ml-2">
                          {entry._count} seasons
                        </span>
                        {seasons.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {seasons.map((s) => (
                              <span
                                key={s.year}
                                className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  s.pnl >= 0
                                    ? "bg-green-50 text-profit"
                                    : "bg-red-50 text-loss"
                                }`}
                              >
                                {s.year}: {s.pnl >= 0 ? "+" : ""}${s.pnl.toFixed(0)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className={`font-bold ${pnl >= 0 ? "text-profit" : "text-loss"}`}>
                      {pnl >= 0 ? "+" : ""}${pnl.toFixed(0)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
