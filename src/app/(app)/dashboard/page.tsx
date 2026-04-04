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

  // Get next venue cutoff (per-venue, 30 min before first race)
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

  // Get user's active bets (tips for open races)
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

  // Recent results (last 5 ledger entries) — include tip details
  const recentResults = await prisma.ledger.findMany({
    where: { userId: user.id },
    include: {
      race: { select: { name: true, venue: true } },
      tip: {
        include: {
          tipLines: {
            include: { runner: { select: { name: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // Latest 3 settled races with top 3 finishers + dividends + user's P&L
  const latestSettledRaces = await prisma.race.findMany({
    where: { status: "final" },
    orderBy: { raceTime: "desc" },
    take: 3,
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

  // Hero data: latest winner
  const latestRace = latestSettledRaces[0] || null;
  const latestWinner = latestRace?.results.find((r) => r.finishPosition === 1);

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-card bg-gradient-to-br from-slate-800 via-slate-850 to-slate-900 p-6 shadow-lg">
        {/* Subtle racing pattern overlay */}
        <div className="absolute inset-0 opacity-[0.04]">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="chevrons" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M0 20 L20 0 L40 20" fill="none" stroke="#d4a843" strokeWidth="1" />
                <path d="M0 40 L20 20 L40 40" fill="none" stroke="#d4a843" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#chevrons)" />
          </svg>
        </div>
        {/* Gold accent line at top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-gold-dark via-gold to-gold-light" />

        <div className="relative">
          {/* Title */}
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-gold-light via-gold to-gold-dark bg-clip-text text-transparent">
            Group 1 Club
          </h1>
          {carnival && (
            <p className="text-sm text-slate-400 mt-0.5">{carnival.name}</p>
          )}

          {/* Rank & P&L row */}
          <div className="flex items-center gap-5 mt-4">
            <div>
              <p className="text-3xl font-bold text-gold">
                {myRank ? `#${myRank}` : "--"}
              </p>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider mt-0.5">
                Rank{sorted.length > 0 ? ` of ${sorted.length}` : ""}
              </p>
            </div>
            <div className="h-10 w-px bg-slate-700" />
            <div>
              <p
                className={`text-3xl font-bold ${
                  totalPnL >= 0 ? "text-profit" : "text-loss"
                }`}
              >
                {totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(0)}
              </p>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider mt-0.5">
                Total P&amp;L
              </p>
            </div>
            <div className="h-10 w-px bg-slate-700" />
            <div>
              <p className="text-3xl font-bold text-slate-300">{racesCompleted}</p>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider mt-0.5">
                Races
              </p>
            </div>
          </div>

          {/* Latest result */}
          {latestRace && latestWinner && (
            <div className="mt-4 pt-4 border-t border-slate-700/60">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">Latest Result</p>
              <p className="text-sm text-slate-200">
                <span className="font-semibold text-gold">{latestRace.name}</span>
                <span className="text-slate-400 mx-1.5">&mdash;</span>
                <span className="text-slate-300">
                  1st {latestWinner.runner.name}
                  {latestWinner.winDividend != null && (
                    <span className="text-gold-light ml-1">(${latestWinner.winDividend.toFixed(2)})</span>
                  )}
                </span>
              </p>
              {/* Top 3 recent winners compact row */}
              {latestSettledRaces.length > 1 && (
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {latestSettledRaces.slice(1).map((race) => {
                    const winner = race.results.find((r) => r.finishPosition === 1);
                    return winner ? (
                      <span
                        key={race.id}
                        className="inline-flex items-center gap-1 text-xs bg-slate-700/50 text-slate-300 px-2 py-1 rounded-full"
                      >
                        <span className="font-medium text-gold-light">{race.name}</span>
                        <span className="text-slate-500">&mdash;</span>
                        {winner.runner.name}
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Countdown Timer — most prominent element when tips are open */}
      {nextCutoff && (
        <Countdown
          cutoffAt={nextCutoff.cutoff.toISOString()}
          untippedCount={untippedRaces.length}
          roundName={nextCutoff.roundName}
          venue={nextCutoff.venue}
        />
      )}

      {/* No active round message */}
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

      {/* Tips Needed — gold-styled prominent section */}
      {untippedRaces.length > 0 && (
        <div className="bg-gradient-to-br from-gold-accent to-white rounded-card p-5 border border-gold/30 shadow-card">
          <h3 className="text-sm font-bold text-gold-dark mb-3 uppercase tracking-wide flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-gold animate-pulse" />
            Tips Needed ({untippedRaces.length})
          </h3>
          <div className="space-y-2">
            {untippedRaces.map((race) => (
              <a
                key={race.id}
                href={`/races/${race.id}`}
                className="flex justify-between items-center text-sm py-2 px-3 -mx-1 rounded-lg hover:bg-gold-accent/60 border border-transparent hover:border-gold/20 transition-all"
              >
                <div>
                  <span className="font-medium text-slate-800">{race.name}</span>
                  <span className="text-xs text-slate-500 ml-2">{race.venue}</span>
                </div>
                <span className="text-gold-dark text-xs font-semibold">Tip &rarr;</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Latest Results — enhanced with top 3 finishers and user P&L */}
      {latestSettledRaces.length > 0 && (
        <div className="bg-white rounded-card p-5 border border-surface-muted shadow-card hover:shadow-card-hover transition-shadow">
          <h3 className="text-sm font-bold text-gold mb-4 uppercase tracking-wide">
            Latest Results
          </h3>
          <div className="space-y-4">
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
                  className={`rounded-lg p-4 border transition-all ${
                    isWin
                      ? "bg-profit/[0.03] border-profit/20 shadow-[0_0_8px_rgba(22,163,74,0.08)]"
                      : "bg-surface border-surface-muted"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2.5">
                    <div>
                      <span className="text-sm font-semibold text-slate-800">{race.name}</span>
                      <span className="text-xs text-slate-400 ml-2">{race.venue}</span>
                    </div>
                    {userProfit != null && (
                      <span
                        className={`text-sm font-bold px-2 py-0.5 rounded-full ${
                          userProfit >= 0
                            ? "text-profit bg-profit/10"
                            : "text-loss bg-loss/10"
                        }`}
                      >
                        {userProfit >= 0 ? "+" : ""}${userProfit.toFixed(0)}
                      </span>
                    )}
                  </div>
                  {/* Top 3 finishers */}
                  <div className="space-y-1">
                    {race.results.map((result) => {
                      const backed = userTipRunners.has(result.runner.name);
                      const posLabel =
                        result.finishPosition === 1
                          ? "1st"
                          : result.finishPosition === 2
                          ? "2nd"
                          : "3rd";
                      const posColor =
                        result.finishPosition === 1
                          ? "text-gold font-bold"
                          : result.finishPosition === 2
                          ? "text-slate-500 font-semibold"
                          : "text-slate-400 font-medium";

                      return (
                        <div
                          key={result.id}
                          className={`flex items-center text-xs py-1 px-2 rounded ${
                            backed
                              ? "bg-profit/[0.06] border border-profit/15"
                              : ""
                          }`}
                        >
                          <span className={`w-8 ${posColor}`}>{posLabel}</span>
                          <span className={`flex-1 ${backed ? "text-profit font-semibold" : "text-slate-700"}`}>
                            {result.runner.name}
                            {backed && (
                              <span className="ml-1.5 text-[10px] bg-profit/15 text-profit px-1.5 py-0.5 rounded-full font-semibold uppercase">
                                Backed
                              </span>
                            )}
                          </span>
                          <span className="text-slate-400 tabular-nums">
                            {result.finishPosition === 1 && result.winDividend != null && (
                              <span>W ${result.winDividend.toFixed(2)}</span>
                            )}
                            {result.placeDividend != null && (
                              <span className="ml-2">P ${result.placeDividend.toFixed(2)}</span>
                            )}
                          </span>
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
        <div className="bg-white rounded-card p-5 border border-surface-muted shadow-card hover:shadow-card-hover transition-shadow">
          <h3 className="text-sm font-bold text-gold mb-3 uppercase tracking-wide">
            Your Bets ({activeBets.length})
          </h3>
          <div className="space-y-3">
            {activeBets.map((bet) => (
              <a
                key={bet.id}
                href={`/races/${bet.raceId}`}
                className="block bg-surface rounded-lg p-3 border border-surface-muted hover:border-gold/30 hover:shadow-sm transition-all"
              >
                <div className="flex justify-between items-start mb-1.5">
                  <span className="font-medium text-sm text-slate-800">{bet.race.name}</span>
                  <span className="text-xs text-slate-400">
                    {new Date(bet.race.raceTime).toLocaleTimeString("en-AU", {
                      hour: "numeric",
                      minute: "2-digit",
                      timeZone: "Australia/Sydney",
                    })}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  {bet.tipLines
                    .map(
                      (tl) =>
                        `$${tl.amount} ${tl.betType.toUpperCase()} ${tl.runner.name}`
                    )
                    .join(", ")}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Quick Stats — compact row below */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-card p-4 border border-surface-muted shadow-card hover:shadow-card-hover transition-shadow text-center">
          <p className="text-2xl font-bold text-gold">
            {myRank ? `#${myRank}` : "--"}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Rank{sorted.length > 0 ? ` / ${sorted.length}` : ""}
          </p>
        </div>
        <div className="bg-white rounded-card p-4 border border-surface-muted shadow-card hover:shadow-card-hover transition-shadow text-center">
          <p
            className={`text-2xl font-bold ${
              totalPnL >= 0 ? "text-profit" : "text-loss"
            }`}
          >
            {totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(0)}
          </p>
          <p className="text-xs text-slate-500 mt-1">Total P&L</p>
        </div>
        <div className="bg-white rounded-card p-4 border border-surface-muted shadow-card hover:shadow-card-hover transition-shadow text-center">
          <p className="text-2xl font-bold text-slate-900">{racesCompleted}</p>
          <p className="text-xs text-slate-500 mt-1">Races</p>
        </div>
      </div>

      {/* Welcome message (show only when no activity) */}
      {recentResults.length === 0 && untippedRaces.length === 0 && !nextCutoff && (
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
              <a href="/admin" className="underline">
                Admin panel
              </a>{" "}
              to manage races and enter results.
            </p>
          )}
        </div>
      )}

      {/* Recent News */}
      {feedItems.length > 0 && (
        <div className="bg-white rounded-card p-5 border border-surface-muted shadow-card hover:shadow-card-hover transition-shadow">
          <h3 className="text-sm font-bold text-gold mb-4 uppercase tracking-wide">
            Recent News
          </h3>
          <div className="space-y-4">
            {feedItems.map((item) => (
              <div key={item.id} className="border-l-2 border-gold/40 pl-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-slate-400">
                    {new Date(item.createdAt).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                      timeZone: "Australia/Sydney",
                    })}
                  </span>
                  {item.source && item.source !== "system" && (
                    <span className="text-xs bg-gold-accent text-gold px-1.5 py-0.5 rounded font-medium">
                      {item.source === "admin" ? "Group 1 Club" : item.source}
                    </span>
                  )}
                  {item.source === "system" && (
                    <span className="text-xs bg-surface text-slate-500 px-1.5 py-0.5 rounded font-medium">
                      {item.type === "result" ? "Result" : item.type === "scratching" ? "Scratching" : item.type === "field" ? "Field" : "Update"}
                    </span>
                  )}
                </div>
                {item.sourceUrl ? (
                  <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-slate-900 hover:text-gold transition">
                    {item.title}
                  </a>
                ) : (
                  <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
                )}
                {item.body && (
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.body}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
