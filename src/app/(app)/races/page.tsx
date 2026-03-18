import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function RacesPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user.id;

  const carnival = await prisma.carnival.findFirst({
    where: { status: { in: ["active", "upcoming"] } },
    include: {
      rounds: {
        include: {
          races: {
            include: { runners: true },
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
        <h2 className="text-xl font-bold text-slate-900 mb-2">No Active Carnival</h2>
        <p className="text-slate-500">Check back when the season starts.</p>
      </div>
    );
  }

  // Get user's tips to show tipped status
  const myTips = userId
    ? await prisma.tip.findMany({
        where: { userId },
        select: { raceId: true },
      })
    : [];
  const tippedRaceIds = new Set(myTips.map((t) => t.raceId));

  // Get user's ledger for P&L on settled races
  const myLedger = userId
    ? await prisma.ledger.findMany({
        where: { userId },
        select: { raceId: true, profit: true },
      })
    : [];
  const ledgerByRace = new Map(myLedger.map((l) => [l.raceId, l.profit]));

  const now = new Date();

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-900">{carnival.name}</h2>

      {carnival.rounds.map((round) => {
        const isPast = new Date(round.cutoffAt) < now;
        const roundRaces = round.races;

        return (
          <div key={round.id}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm text-gold font-semibold uppercase tracking-wide">
                {new Date(round.raceDate).toLocaleDateString("en-AU", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}{" "}
                · Round {round.number}
              </h3>
              {!isPast && roundRaces.some((r) => r.status === "open") && (
                <span className="text-xs text-gold bg-gold-accent px-2 py-0.5 rounded font-medium">
                  Tips Open
                </span>
              )}
            </div>

            <div className="space-y-2">
              {roundRaces.map((race) => {
                const hasTipped = tippedRaceIds.has(race.id);
                const profit = ledgerByRace.get(race.id);
                const activeRunners = race.runners.filter((r) => !r.isScratched).length;

                return (
                  <a
                    key={race.id}
                    href={`/races/${race.id}`}
                    className="block bg-white rounded-card p-4 border border-surface-muted shadow-card hover:shadow-card-hover transition"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-slate-900 truncate">{race.name}</h4>
                          {race.status === "open" && hasTipped && (
                            <span className="text-xs text-profit flex-shrink-0">&#10003;</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {race.venue} · {race.distance}m
                          {race.raceNumber > 0 && ` · R${race.raceNumber}`}
                          {race.prizePool && ` · ${race.prizePool}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className="text-xs bg-surface text-slate-600 px-2 py-0.5 rounded">
                          {race.grade}
                        </span>
                        {profit !== undefined ? (
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded ${
                              profit >= 0
                                ? "bg-green-50 text-profit"
                                : "bg-red-50 text-loss"
                            }`}
                          >
                            {profit >= 0 ? "+" : ""}${profit.toFixed(0)}
                          </span>
                        ) : (
                          <TipButton status={race.status} hasTipped={hasTipped} />
                        )}
                      </div>
                    </div>
                    {activeRunners > 0 && (
                      <p className="text-xs text-slate-400 mt-2">
                        {activeRunners} runners
                        {race.runners.length !== activeRunners && (
                          <span className="text-loss ml-1">
                            ({race.runners.length - activeRunners} scratched)
                          </span>
                        )}
                      </p>
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TipButton({ status, hasTipped }: { status: string; hasTipped: boolean }) {
  if (status === "open" && !hasTipped) {
    return (
      <span className="text-sm font-bold px-4 py-2 rounded-lg bg-gold text-white shadow-sm">
        Tip Now
      </span>
    );
  }

  if (status === "open" && hasTipped) {
    return (
      <span className="flex flex-col items-center gap-0.5">
        <span className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-green-50 text-profit border border-green-200">
          &#10003; Tipped
        </span>
        <span className="text-[10px] text-slate-400">tap to edit</span>
      </span>
    );
  }

  const styles: Record<string, string> = {
    upcoming: "bg-slate-100 text-slate-500",
    closed: "bg-slate-100 text-slate-500",
    final: "bg-green-50 text-profit",
    abandoned: "bg-slate-100 text-slate-400",
  };

  const labels: Record<string, string> = {
    upcoming: "TBA",
    closed: "Locked",
    final: "Result",
    abandoned: "Void",
  };

  return (
    <span
      className={`text-xs px-2 py-1 rounded font-medium ${styles[status] || styles.upcoming}`}
    >
      {labels[status] || status}
    </span>
  );
}
