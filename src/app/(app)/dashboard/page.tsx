import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Countdown } from "@/components/countdown";
import { getNextCutoff } from "@/lib/cutoff";

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

  // Recent results (last 5 ledger entries)
  const recentResults = await prisma.ledger.findMany({
    where: { userId: user.id },
    include: { race: { select: { name: true, venue: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <div className="space-y-6">
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
      {!nextCutoff && carnival && (
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

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-card p-4 border border-surface-muted shadow-card text-center">
          <p className="text-2xl font-bold text-gold">
            {myRank ? `#${myRank}` : "--"}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Rank{sorted.length > 0 ? ` / ${sorted.length}` : ""}
          </p>
        </div>
        <div className="bg-white rounded-card p-4 border border-surface-muted shadow-card text-center">
          <p
            className={`text-2xl font-bold ${
              totalPnL >= 0 ? "text-profit" : "text-loss"
            }`}
          >
            {totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(0)}
          </p>
          <p className="text-xs text-slate-500 mt-1">Total P&L</p>
        </div>
        <div className="bg-white rounded-card p-4 border border-surface-muted shadow-card text-center">
          <p className="text-2xl font-bold text-slate-900">{racesCompleted}</p>
          <p className="text-xs text-slate-500 mt-1">Races</p>
        </div>
      </div>

      {/* Untipped races list */}
      {untippedRaces.length > 0 && (
        <div className="bg-white rounded-card p-5 border border-surface-muted shadow-card">
          <h3 className="text-sm font-bold text-gold mb-3 uppercase tracking-wide">
            Tips Needed ({untippedRaces.length})
          </h3>
          <div className="space-y-2">
            {untippedRaces.map((race) => (
              <a
                key={race.id}
                href={`/races/${race.id}`}
                className="flex justify-between items-center text-sm py-1.5 px-2 -mx-2 rounded hover:bg-surface-hover transition"
              >
                <div>
                  <span className="font-medium text-slate-800">{race.name}</span>
                  <span className="text-xs text-slate-500 ml-2">{race.venue}</span>
                </div>
                <span className="text-gold text-xs font-semibold">Tip &rarr;</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Active Bets */}
      {activeBets.length > 0 && (
        <div className="bg-white rounded-card p-5 border border-surface-muted shadow-card">
          <h3 className="text-sm font-bold text-gold mb-3 uppercase tracking-wide">
            Your Bets ({activeBets.length})
          </h3>
          <div className="space-y-3">
            {activeBets.map((bet) => (
              <a
                key={bet.id}
                href={`/races/${bet.raceId}`}
                className="block bg-surface rounded-lg p-3 border border-surface-muted hover:border-gold/30 transition"
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

      {/* Recent Results */}
      {recentResults.length > 0 && (
        <div className="bg-white rounded-card p-5 border border-surface-muted shadow-card">
          <h3 className="text-sm font-bold text-gold mb-3 uppercase tracking-wide">
            Recent Results
          </h3>
          <div className="space-y-2">
            {recentResults.map((entry) => (
              <div key={entry.id} className="flex justify-between text-sm">
                <span className="text-slate-700">{entry.race.name}</span>
                <span
                  className={`font-semibold ${
                    entry.profit >= 0 ? "text-profit" : "text-loss"
                  }`}
                >
                  {entry.profit >= 0 ? "+" : ""}${entry.profit.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* From the Track — News & Updates */}
      <div className="bg-white rounded-card p-5 border border-surface-muted shadow-card">
        <h3 className="text-sm font-bold text-gold mb-4 uppercase tracking-wide">
          From the Track
        </h3>
        <div className="space-y-4">
          <div className="border-l-2 border-gold/40 pl-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-slate-400">17 Mar 2026</span>
              <span className="text-xs bg-gold-accent text-gold px-1.5 py-0.5 rounded font-medium">
                Racing NSW
              </span>
            </div>
            <h4 className="text-sm font-semibold text-slate-900">
              Golden Slipper 2026: Final Field Confirmed
            </h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              The 20-runner field for Saturday&apos;s $5 million Golden Slipper at Rosehill
              has been locked in. Fireball heads the market as the early favourite
              after a dominant trial, with Closer To Free and Paradoxium also well-fancied.
            </p>
          </div>

          <div className="border-l-2 border-gold/40 pl-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-slate-400">16 Mar 2026</span>
              <span className="text-xs bg-gold-accent text-gold px-1.5 py-0.5 rounded font-medium">
                Form Guide
              </span>
            </div>
            <h4 className="text-sm font-semibold text-slate-900">
              Barrier Draw Analysis: Who Benefits?
            </h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Barriers can make or break a Slipper campaign. We look at the historical
              data from Rosehill&apos;s 1200m and assess which runners have drawn
              to advantage heading into Saturday&apos;s feature.
            </p>
          </div>

          <div className="border-l-2 border-gold/40 pl-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-slate-400">15 Mar 2026</span>
              <span className="text-xs bg-gold-accent text-gold px-1.5 py-0.5 rounded font-medium">
                Group 1 Club
              </span>
            </div>
            <h4 className="text-sm font-semibold text-slate-900">
              Tips Open: Round 1 is Live
            </h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              The 2026 Autumn Racing Carnival is underway! Get your tips in before
              cutoff for all Round 1 races. Remember: $100 notional budget per race,
              split across up to 4 selections.
            </p>
          </div>

          <div className="border-l-2 border-gold/40 pl-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-slate-400">14 Mar 2026</span>
              <span className="text-xs bg-gold-accent text-gold px-1.5 py-0.5 rounded font-medium">
                Racing NSW
              </span>
            </div>
            <h4 className="text-sm font-semibold text-slate-900">
              Rosehill Track Rated Good 4 Ahead of Slipper Day
            </h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Track managers are expecting a Good 4 surface for Saturday&apos;s
              blockbuster program. Fine weather is forecast through the week with
              no significant rain expected before race day.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
