import { prisma } from "@/lib/prisma";

export default async function HonourRollPage() {
  const entries = await prisma.honourRoll.findMany({
    orderBy: { year: "desc" },
  });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-900">The Golden Ponies 🏆</h2>

      {entries.length === 0 ? (
        <div className="bg-white rounded-card p-8 border border-surface-muted shadow-card text-center">
          <p className="text-slate-500">Honour roll data loading soon.</p>
        </div>
      ) : (
        entries.map((entry) => (
          <div
            key={entry.id}
            className="bg-white rounded-card p-5 border border-surface-muted shadow-card"
          >
            <h3 className="text-lg font-bold text-gold mb-3">{entry.year}</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-800">🏆 {entry.winnerName}</span>
                <span
                  className={`font-bold ${entry.winnerProfit >= 0 ? "text-profit" : "text-loss"}`}
                >
                  {entry.winnerProfit >= 0 ? "+" : ""}$
                  {entry.winnerProfit.toFixed(2)}
                </span>
              </div>
              {entry.runnerUpName && (
                <div className="flex justify-between text-slate-600">
                  <span>🥈 {entry.runnerUpName}</span>
                  <span>
                    {entry.runnerUpProfit != null &&
                      `${entry.runnerUpProfit >= 0 ? "+" : ""}$${entry.runnerUpProfit.toFixed(2)}`}
                  </span>
                </div>
              )}
              {entry.thirdName && (
                <div className="flex justify-between text-slate-600">
                  <span>🥉 {entry.thirdName}</span>
                  <span>
                    {entry.thirdProfit != null &&
                      `${entry.thirdProfit >= 0 ? "+" : ""}$${entry.thirdProfit.toFixed(2)}`}
                  </span>
                </div>
              )}
              {entry.woodenSpoonName && (
                <div className="flex justify-between text-slate-500 mt-2 pt-2 border-t border-surface-muted">
                  <span>🥄 {entry.woodenSpoonName}</span>
                  <span className="text-loss">
                    {entry.woodenSpoonProfit != null &&
                      `$${entry.woodenSpoonProfit.toFixed(2)}`}
                  </span>
                </div>
              )}
              {entry.entrants && (
                <p className="text-xs text-slate-400 mt-2">
                  {entry.entrants} entrants &middot; {entry.races} races
                </p>
              )}
              {entry.notes && (
                <p className="text-xs text-slate-500 italic mt-1">
                  {entry.notes}
                </p>
              )}
            </div>
          </div>
        ))
      )}

      <div className="bg-white rounded-card p-5 border border-surface-muted shadow-card">
        <h3 className="text-sm font-bold text-gold mb-2 uppercase tracking-wide">
          Hall of Fame
        </h3>
        <div className="text-sm space-y-1 text-slate-600">
          <p>
            <strong>Rodda</strong> — 3x Champion (2016, 2019, 2021)
          </p>
          <p>
            <strong>Law</strong> — 2x Champion (2018, 2025)
          </p>
          <p>
            <strong>Simmo</strong> — 4x Wooden Spoon (2017, 2019, 2021, 2025)
          </p>
        </div>
      </div>
    </div>
  );
}
