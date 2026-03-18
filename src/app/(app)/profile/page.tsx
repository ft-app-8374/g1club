import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LogoutButton } from "./logout-button";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = session.user;

  // Current season P&L from ledger
  const ledgerEntries = await prisma.ledger.findMany({
    where: { userId: user.id },
    select: { profit: true },
  });
  const currentPnl = ledgerEntries.reduce((sum, e) => sum + e.profit, 0);
  const currentRaces = ledgerEntries.length;

  // Historical seasons from SeasonResult
  const seasonResults = await prisma.seasonResult.findMany({
    where: { userId: user.id },
    orderBy: { year: "desc" },
    select: { year: true, totalPnl: true, rank: true, displayName: true },
  });

  const lifetimePnl = seasonResults.reduce((sum, s) => sum + s.totalPnl, 0);
  const bestSeason = seasonResults.length > 0
    ? seasonResults.reduce((best, s) => s.totalPnl > best.totalPnl ? s : best)
    : null;
  const bestRank = seasonResults.length > 0
    ? seasonResults.reduce((best, s) => s.rank < best.rank ? s : best)
    : null;

  // Podium finishes
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const goldCount = seasonResults.filter((s) => s.rank === 1).length;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const silverCount = seasonResults.filter((s) => s.rank === 2).length;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const bronzeCount = seasonResults.filter((s) => s.rank === 3).length;

  // Wooden spoon: check if rank equals the highest rank for that year
  // Query the max rank per year from SeasonResult
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let woodenSpoonCount = 0;
  if (seasonResults.length > 0) {
    const years = seasonResults.map((s) => s.year);
    const maxRanks = await prisma.seasonResult.groupBy({
      by: ["year"],
      where: { year: { in: years } },
      _max: { rank: true },
    });
    const maxRankByYear = new Map(
      maxRanks.map((r) => [r.year, r._max.rank])
    );
    woodenSpoonCount = seasonResults.filter(
      (s) => s.rank === maxRankByYear.get(s.year) && (maxRankByYear.get(s.year) || 0) > 1
    ).length;
  }

  return (
    <div className="space-y-6">
      <div className="text-center py-6">
        <div className="w-20 h-20 bg-gold-accent rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-3xl text-gold font-bold">
            {user.username[0].toUpperCase()}
          </span>
        </div>
        <h2 className="text-xl font-bold text-slate-900">{user.username}</h2>
        <p className="text-sm text-slate-500">{user.email}</p>
        {user.role === "admin" && (
          <span className="inline-block mt-2 text-xs bg-gold-accent text-gold px-3 py-1 rounded-full font-medium">
            Admin
          </span>
        )}
      </div>

      {/* P&L Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-card p-4 border border-surface-muted shadow-card text-center">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">This Season</p>
          <p className={`text-xl font-bold ${currentPnl >= 0 ? "text-profit" : "text-loss"}`}>
            {currentPnl >= 0 ? "+" : ""}${currentPnl.toFixed(0)}
          </p>
          <p className="text-xs text-slate-400">{currentRaces} races</p>
        </div>
        <div className="bg-white rounded-card p-4 border border-surface-muted shadow-card text-center">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Lifetime</p>
          <p className={`text-xl font-bold ${lifetimePnl >= 0 ? "text-profit" : "text-loss"}`}>
            {lifetimePnl >= 0 ? "+" : ""}${lifetimePnl.toFixed(0)}
          </p>
          <p className="text-xs text-slate-400">{seasonResults.length} seasons</p>
        </div>
      </div>

      {bestSeason && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-card p-4 border border-surface-muted shadow-card text-center">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Best Season</p>
            <p className="text-lg font-bold text-profit">
              +${bestSeason.totalPnl.toFixed(0)}
            </p>
            <p className="text-xs text-slate-400">{bestSeason.year}</p>
          </div>
          <div className="bg-white rounded-card p-4 border border-surface-muted shadow-card text-center">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Best Finish</p>
            <p className="text-lg font-bold text-gold">
              {bestRank!.rank === 1 ? "🏆" : ""} #{bestRank!.rank}
            </p>
            <p className="text-xs text-slate-400">{bestRank!.year}</p>
          </div>
        </div>
      )}

      {/* Podium Finishes */}
      {seasonResults.length > 0 && (goldCount > 0 || silverCount > 0 || bronzeCount > 0 || woodenSpoonCount > 0) && (
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white rounded-card p-3 border border-surface-muted shadow-card text-center">
            <p className="text-2xl mb-1">🥇</p>
            <p className="text-xl font-bold text-slate-900">{goldCount}</p>
            <p className="text-xs text-slate-400">1st</p>
          </div>
          <div className="bg-white rounded-card p-3 border border-surface-muted shadow-card text-center">
            <p className="text-2xl mb-1">🥈</p>
            <p className="text-xl font-bold text-slate-900">{silverCount}</p>
            <p className="text-xs text-slate-400">2nd</p>
          </div>
          <div className="bg-white rounded-card p-3 border border-surface-muted shadow-card text-center">
            <p className="text-2xl mb-1">🥉</p>
            <p className="text-xl font-bold text-slate-900">{bronzeCount}</p>
            <p className="text-xs text-slate-400">3rd</p>
          </div>
          <div className="bg-white rounded-card p-3 border border-surface-muted shadow-card text-center">
            <p className="text-2xl mb-1">🥄</p>
            <p className="text-xl font-bold text-slate-900">{woodenSpoonCount}</p>
            <p className="text-xs text-slate-400">Last</p>
          </div>
        </div>
      )}

      {/* Season History */}
      {seasonResults.length > 0 && (
        <div className="bg-white rounded-card p-5 border border-surface-muted shadow-card">
          <h3 className="text-sm font-bold text-gold mb-3 uppercase tracking-wide">
            Season History
          </h3>
          <div className="space-y-2">
            {seasonResults.map((s) => (
              <div key={s.year} className="flex justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-slate-900 font-medium">{s.year}</span>
                  <span className="text-xs text-slate-400">#{s.rank}</span>
                  {s.displayName !== user.username && (
                    <span className="text-xs text-slate-300">as {s.displayName}</span>
                  )}
                </div>
                <span className={`font-semibold ${s.totalPnl >= 0 ? "text-profit" : "text-loss"}`}>
                  {s.totalPnl >= 0 ? "+" : ""}${s.totalPnl.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Account Info */}
      <div className="bg-white rounded-card p-5 border border-surface-muted shadow-card">
        <h3 className="text-sm font-bold text-gold mb-3 uppercase tracking-wide">
          Account
        </h3>
        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex justify-between">
            <span>Username</span>
            <span className="text-slate-900">{user.username}</span>
          </div>
          <div className="flex justify-between">
            <span>Email</span>
            <span className="text-slate-900">{user.email}</span>
          </div>
          <div className="flex justify-between">
            <span>Role</span>
            <span className="capitalize text-slate-900">{user.role}</span>
          </div>
        </div>
      </div>

      <LogoutButton />
    </div>
  );
}
