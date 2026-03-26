import { prisma } from "@/lib/prisma";

export default async function CalendarPage() {
  // Get all races for the active carnival, grouped by round/date
  const carnival = await prisma.carnival.findFirst({
    where: { status: { in: ["active", "upcoming"] } },
    include: {
      rounds: {
        include: {
          races: {
            orderBy: { raceTime: "asc" },
            select: {
              id: true,
              name: true,
              venue: true,
              distance: true,
              raceNumber: true,
              grade: true,
              prizePool: true,
              raceTime: true,
              raceType: true,
              status: true,
              _count: { select: { runners: true } },
            },
          },
        },
        orderBy: { raceDate: "asc" },
      },
    },
  });

  if (!carnival) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold text-slate-900 mb-2">No Active Season</h2>
        <p className="text-slate-500">The race calendar will appear when the season starts.</p>
      </div>
    );
  }

  const now = new Date();

  // Group rounds by month for display
  const roundsByMonth: Record<string, typeof carnival.rounds> = {};
  for (const round of carnival.rounds) {
    const month = new Date(round.raceDate).toLocaleDateString("en-AU", {
      month: "long",
      year: "numeric",
    });
    if (!roundsByMonth[month]) roundsByMonth[month] = [];
    roundsByMonth[month].push(round);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{carnival.name}</h2>
        <p className="text-sm text-slate-500 mt-1">
          {new Date(carnival.startDate).toLocaleDateString("en-AU", {
            day: "numeric",
            month: "short",
          })}{" "}
          –{" "}
          {new Date(carnival.endDate).toLocaleDateString("en-AU", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
          {" · "}
          {carnival.rounds.reduce((sum, r) => sum + r.races.length, 0)} races
        </p>
      </div>

      {Object.entries(roundsByMonth).map(([month, rounds]) => (
        <div key={month}>
          <h3 className="text-sm font-bold text-gold uppercase tracking-wide mb-3">
            {month}
          </h3>

          <div className="space-y-3">
            {rounds.map((round) => {
              const raceDate = new Date(round.raceDate);
              const isPast = raceDate < now;
              const isToday = raceDate.toDateString() === now.toDateString();

              return (
                <div
                  key={round.id}
                  className={`bg-white rounded-card border shadow-card overflow-hidden ${
                    isToday
                      ? "border-gold"
                      : isPast
                        ? "border-surface-muted opacity-75"
                        : "border-surface-muted"
                  }`}
                >
                  {/* Date header */}
                  <div
                    className={`px-4 py-2 flex items-center justify-between ${
                      isToday ? "bg-gold-accent" : isPast ? "bg-slate-50" : "bg-surface"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {raceDate.toLocaleDateString("en-AU", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                      {isToday && (
                        <span className="text-xs bg-gold text-white px-2 py-0.5 rounded-full font-medium">
                          Today
                        </span>
                      )}
                      {round.name && (
                        <span className="text-xs text-slate-500">
                          · {round.name}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">
                      {round.races.length} race{round.races.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Races */}
                  <div className="divide-y divide-surface-muted">
                    {round.races.map((race) => {
                      const raceTime = new Date(race.raceTime);
                      const racePast = raceTime < now;

                      return (
                        <a
                          key={race.id}
                          href={`/races/${race.id}`}
                          className="flex items-center justify-between px-4 py-3 hover:bg-surface transition"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-slate-400 w-8">
                                R{race.raceNumber}
                              </span>
                              <span
                                className={`font-semibold text-sm truncate ${
                                  racePast ? "text-slate-400" : "text-slate-900"
                                }`}
                              >
                                {race.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 ml-8">
                              <span className="text-xs text-slate-400">
                                {race.venue} · {race.distance}m
                              </span>
                              {race.prizePool && (
                                <span className="text-xs text-slate-400">
                                  · {race.prizePool}
                                </span>
                              )}
                              {race._count.runners > 0 && (
                                <span className="text-xs text-slate-400">
                                  · {race._count.runners} runners
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            <span className="text-xs bg-surface text-slate-600 px-2 py-0.5 rounded">
                              {race.grade}
                            </span>
                            <span className="text-xs text-slate-400">
                              {raceTime.toLocaleTimeString("en-AU", {
                                hour: "numeric",
                                minute: "2-digit",
                                timeZone: "Australia/Sydney",
                              })}
                            </span>
                            {race.status === "final" && (
                              <span className="text-xs bg-green-50 text-profit px-1.5 py-0.5 rounded">
                                ✓
                              </span>
                            )}
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
