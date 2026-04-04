import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Countdown } from "@/components/countdown";
import { getNextCutoff } from "@/lib/cutoff";
import { getLatestFeed } from "@/lib/feed";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const user = session!.user;

  // Get active carnival
  const carnival = await prisma.carnival.findFirst({
    where: { status: { in: ["active", "upcoming"] } },
    include: {
      rounds: {
        include: { races: true },
        orderBy: { raceDate: "asc" },
      },
    },
  });

  // Get all users' P&L for ranking
  const allLedger = await prisma.ledger.groupBy({
    by: ["userId"],
    _sum: { profit: true },
    _count: true,
  });

  const sorted = allLedger
    .map((l) => ({ userId: l.userId, profit: l._sum.profit || 0, races: l._count }))
    .sort((a, b) => b.profit - a.profit);

  const myEntry = sorted.find((s) => s.userId === user.id);
  const myRank = myEntry ? sorted.indexOf(myEntry) + 1 : null;
  const totalPnL = myEntry?.profit || 0;
  const racesCompleted = myEntry?.races || 0;

  // Get next venue cutoff
  const nextCutoff = await getNextCutoff();

  // Find open races the user hasn't tipped on yet
  const openRaces = carnival?.rounds.flatMap((r) =>
    r.races.filter((race) => race.status === "open")
  ) || [];

  const myTips = await prisma.tip.findMany({
    where: { userId: user.id },
    select: { raceId: true },
  });
  const tippedRaceIds = new Set(myTips.map((t) => t.raceId));
  const untippedRaces = openRaces.filter((r) => !tippedRaceIds.has(r.id));

  // Get user's active bets
  const activeBets = await prisma.tip.findMany({
    where: {
      userId: user.id,
      race: { status: { in: ["open", "closed"] } },
    },
    include: {
      race: { select: { name: true, venue: true, raceTime: true } },
      tipLines: {
        include: { runner: { select: { name: true } } },
      },
    },
    orderBy: { race: { raceTime: "asc" } },
    take: 10,
  });

  // Latest 3 settled races with top 3 finishers + dividends + user's P&L
  const latestSettledRaces = await prisma.race.findMany({
    where: { status: "final" },
    orderBy: { raceTime: "asc" },
    take: 6,
    include: {
      results: {
        where: { finishPosition: { lte: 3 } },
        orderBy: { finishPosition: "asc" },
        include: { runner: { select: { name: true, runnerNumber: true } } },
      },
      ledger: {
        where: { userId: user.id },
        select: { profit: true, tip: { select: { tipLines: { include: { runner: { select: { name: true } } } } } } },
      },
    },
  });

  const feedItems = await getLatestFeed(8);

  return (
    <div className="space-y-5">
      {/* Full-width hero with racing background */}
      <div className="relative overflow-hidden rounded-card" style={{
        background: "linear-gradient(135deg, #1a1f2e 0%, #0f1420 50%, #1a1f2e 100%)",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='200'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='600' y2='0'%3E%3Cstop offset='0' stop-color='%23d4a843' stop-opacity='0.03'/%3E%3Cstop offset='0.5' stop-color='%23d4a843' stop-opacity='0.08'/%3E%3Cstop offset='1' stop-color='%23d4a843' stop-opacity='0.03'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M0 180 Q150 120 300 140 T600 100' fill='none' stroke='url(%23g)' stroke-width='2'/%3E%3Cpath d='M0 160 Q150 100 300 120 T600 80' fill='none' stroke='url(%23g)' stroke-width='1.5'/%3E%3Cpath d='M0 200 Q150 140 300 160 T600 120' fill='none' stroke='url(%23g)' stroke-width='1'/%3E%3C/svg%3E")`,
        backgroundPosition: "bottom",
        backgroundRepeat: "repeat-x",
      }}>
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gold to-transparent" />
        <div className="p-5 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Welcome back, <span className="text-gold">{user.username}</span>
              </h1>
              {carnival && (
                <p className="text-xs text-slate-500 mt-0.5">{carnival.name}</p>
              )}
            </div>
            {myRank && (
              <div className="text-right">
                <span className="text-2xl font-black text-gold">#{myRank}</span>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                  of {sorted.length}
                </p>
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="flex gap-3">
            <div className="flex-1 bg-white/[0.06] rounded-lg px-3 py-2.5 text-center backdrop-blur-sm">
              <p className={`text-lg font-bold ${totalPnL >= 0 ? "text-profit" : "text-loss"}`}>
                {totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(0)}
              </p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">P&amp;L</p>
            </div>
            <div className="flex-1 bg-white/[0.06] rounded-lg px-3 py-2.5 text-center backdrop-blur-sm">
              <p className="text-lg font-bold text-slate-200">{racesCompleted}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Races</p>
            </div>
            <div className="flex-1 bg-white/[0.06] rounded-lg px-3 py-2.5 text-center backdrop-blur-sm">
              <p className="text-lg font-bold text-gold">{untippedRaces.length}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">To Tip</p>
            </div>
          </div>
        </div>
      </div>

      {/* Countdown Timer */}
      {nextCutoff && (
        <Countdown
          cutoffAt={nextCutoff.cutoff.toISOString()}
          untippedCount={untippedRaces.length}
          roundName={nextCutoff.roundName}
          venue={nextCutoff.venue}
        />
      )}

      {/* Tips Needed */}
      {untippedRaces.length > 0 && (
        <div className="bg-white rounded-card p-4 border-l-4 border-gold shadow-card">
          <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-gold animate-pulse" />
            Tip Now ({untippedRaces.length})
          </h3>
          <div className="space-y-1.5">
            {untippedRaces.map((race) => (
              <a
                key={race.id}
                href={`/races/${race.id}`}
                className="flex justify-between items-center text-sm py-2 px-3 rounded-lg hover:bg-surface transition"
              >
                <div>
                  <span className="font-medium text-slate-800">{race.name}</span>
                  <span className="text-xs text-slate-400 ml-2">{race.venue}</span>
                </div>
                <span className="text-xs font-bold text-gold bg-gold-accent px-2 py-1 rounded">Tip &rarr;</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Race Results */}
      {latestSettledRaces.length > 0 && (
        <div className="bg-white rounded-card p-4 border border-surface-muted shadow-card">
          <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wide">
            Results
          </h3>
          <div className="space-y-3">
            {latestSettledRaces.map((race) => {
              const userLedger = race.ledger[0];
              const userTipRunners = new Set(
                userLedger?.tip?.tipLines.map((tl) => tl.runner.name) || []
              );
              const userProfit = userLedger?.profit;
              const isWin = userProfit != null && userProfit > 0;

              return (
                <div
                  key={race.id}
                  className={`rounded-lg p-3 border ${
                    isWin
                      ? "bg-profit/[0.03] border-profit/20"
                      : "bg-surface/50 border-surface-muted"
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-slate-800">{race.name}
                      <span className="text-xs text-slate-400 font-normal ml-1.5">{race.venue}</span>
                    </span>
                    {userProfit != null && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        userProfit >= 0 ? "text-profit bg-profit/10" : "text-loss bg-loss/10"
                      }`}>
                        {userProfit >= 0 ? "+" : ""}${userProfit.toFixed(0)}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 text-xs">
                    {race.results.map((result) => {
                      const backed = userTipRunners.has(result.runner.name);
                      return (
                        <div key={result.id} className="flex items-center gap-1">
                          <span className={
                            result.finishPosition === 1 ? "text-gold font-bold" :
                            result.finishPosition === 2 ? "text-slate-500 font-semibold" :
                            "text-slate-400"
                          }>
                            {result.finishPosition === 1 ? "1st" : result.finishPosition === 2 ? "2nd" : "3rd"}
                          </span>
                          <span className={backed ? "text-profit font-semibold" : "text-slate-600"}>
                            {result.runner.name}
                          </span>
                          {result.finishPosition === 1 && result.winDividend != null && (
                            <span className="text-slate-400">${result.winDividend.toFixed(2)}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Bets */}
      {activeBets.length > 0 && (
        <div className="bg-white rounded-card p-4 border border-surface-muted shadow-card">
          <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wide">
            Your Bets ({activeBets.length})
          </h3>
          <div className="space-y-2">
            {activeBets.map((bet) => (
              <a
                key={bet.id}
                href={`/races/${bet.raceId}`}
                className="block bg-surface rounded-lg p-3 hover:shadow-sm transition"
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-sm text-slate-800">{bet.race.name}</span>
                  <span className="text-xs text-slate-400">
                    {new Date(bet.race.raceTime).toLocaleTimeString("en-AU", {
                      hour: "numeric",
                      minute: "2-digit",
                      timeZone: "Australia/Sydney",
                    })}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {bet.tipLines
                    .map((tl) => `$${tl.amount} ${tl.betType.toUpperCase()} ${tl.runner.name}`)
                    .join(", ")}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* No active round */}
      {!nextCutoff && carnival && carnival.status !== "active" && (
        <div className="bg-white rounded-card p-6 border border-surface-muted shadow-card text-center">
          <p className="text-slate-500">
            {carnival.status === "completed"
              ? "Season complete! Final standings below."
              : `${carnival.name} starts soon. Stay tuned!`}
          </p>
        </div>
      )}

      {!carnival && (
        <div className="bg-white rounded-card p-6 border border-surface-muted shadow-card text-center">
          <p className="text-slate-500">No active carnival. Check back soon!</p>
        </div>
      )}

      {/* Welcome (no activity) */}
      {latestSettledRaces.length === 0 && untippedRaces.length === 0 && !nextCutoff && (
        <div className="bg-white rounded-card p-6 border border-surface-muted shadow-card">
          <h3 className="text-lg font-bold text-slate-900 mb-2">
            Welcome, {user.username}!
          </h3>
          <p className="text-slate-500 text-sm leading-relaxed">
            When the carnival is active, you&apos;ll see open races to tip on,
            your results, and leaderboard position here.
          </p>
          {user.role === "admin" && (
            <p className="text-gold text-sm mt-3">
              Head to the{" "}
              <a href="/admin" className="underline">Admin panel</a>{" "}
              to manage races and enter results.
            </p>
          )}
        </div>
      )}

      {/* Recent News */}
      {feedItems.length > 0 && (
        <div className="bg-white rounded-card p-4 border border-surface-muted shadow-card">
          <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wide">
            News
          </h3>
          <div className="space-y-3">
            {feedItems.map((item) => (
              <div key={item.id} className="border-l-2 border-gold/30 pl-3">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] text-slate-400">
                    {new Date(item.createdAt).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                      timeZone: "Australia/Sydney",
                    })}
                  </span>
                  {item.source === "system" && (
                    <span className="text-[10px] bg-surface text-slate-500 px-1.5 py-0.5 rounded">
                      {item.type === "result" ? "Result" : item.type === "scratching" ? "Scratching" : "Update"}
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-semibold text-slate-800">{item.title}</h4>
                {item.body && (
                  <p className="text-xs text-slate-500 mt-0.5">{item.body}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
