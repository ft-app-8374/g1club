import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function LeaderboardPage() {
  const session = await getServerSession(authOptions);

  // Aggregate P&L per user from ledger
  const entries = await prisma.ledger.findMany({
    include: { user: { select: { id: true, username: true } } },
  });

  // Build leaderboard
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

  const leaderboard = Array.from(userMap.values()).sort(
    (a, b) => b.profit - a.profit
  );

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Leaderboard</h2>

      {leaderboard.length === 0 ? (
        <div className="bg-navy-card rounded-xl p-8 border border-navy-border text-center">
          <p className="text-slate-400">
            No results yet. The leaderboard will populate once races are
            settled.
          </p>
        </div>
      ) : (
        <div className="bg-navy-card rounded-xl border border-navy-border overflow-hidden">
          {leaderboard.map((entry, i) => {
            const isMe = entry.userId === session?.user.id;
            const isLast = i === leaderboard.length - 1;
            return (
              <div
                key={entry.userId}
                className={`flex items-center justify-between px-4 py-3 ${
                  !isLast ? "border-b border-navy-border" : ""
                } ${isMe ? "bg-gold/5" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg w-8 text-center">
                    {i < 3 ? medals[i] : i === leaderboard.length - 1 ? "🥄" : `${i + 1}`}
                  </span>
                  <div>
                    <span
                      className={`font-semibold ${isMe ? "text-gold" : ""}`}
                    >
                      {entry.username}
                    </span>
                    <span className="text-xs text-slate-500 ml-2">
                      {entry.races} races
                    </span>
                  </div>
                </div>
                <span
                  className={`font-bold ${
                    entry.profit >= 0 ? "text-profit" : "text-loss"
                  }`}
                >
                  {entry.profit >= 0 ? "+" : ""}${entry.profit.toFixed(0)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
