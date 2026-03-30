import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function RacesPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user.id;

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Fetch races in the next 7 days that are not final or abandoned
  const races = await prisma.race.findMany({
    where: {
      raceTime: {
        gte: now,
        lte: sevenDaysFromNow,
      },
      status: {
        notIn: ["final", "abandoned"],
      },
    },
    include: { runners: true },
    orderBy: [{ raceTime: "asc" }, { raceNumber: "asc" }],
  });

  if (races.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold text-slate-900 mb-2">No Upcoming Races</h2>
        <p className="text-slate-500">There are no races to tip in the next 7 days.</p>
      </div>
    );
  }

  // Get user's tips to show tipped status
  const raceIds = races.map((r) => r.id);
  const myTips = userId
    ? await prisma.tip.findMany({
        where: { userId, raceId: { in: raceIds } },
        select: { raceId: true },
      })
    : [];
  const tippedRaceIds = new Set(myTips.map((t) => t.raceId));

  // Group races by venue + date
  type RaceWithRunners = (typeof races)[number];
  const groups = new Map<string, { venue: string; date: Date; races: RaceWithRunners[] }>();

  for (const race of races) {
    const dateStr = new Date(race.raceTime).toISOString().slice(0, 10);
    const key = `${race.venue}|${dateStr}`;
    if (!groups.has(key)) {
      groups.set(key, { venue: race.venue, date: new Date(dateStr), races: [] });
    }
    groups.get(key)!.races.push(race);
  }

  const sortedGroups = Array.from(groups.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-900">Tips</h2>

      {sortedGroups.map((group) => (
        <div key={`${group.venue}-${group.date.toISOString()}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm text-gold font-semibold uppercase tracking-wide">
              {group.venue} &middot;{" "}
              {group.date.toLocaleDateString("en-AU", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </h3>
            {group.races.some((r) => r.status === "open") && (
              <span className="text-xs text-gold bg-gold-accent px-2 py-0.5 rounded font-medium">
                Tips Open
              </span>
            )}
          </div>

          <div className="space-y-2">
            {group.races.map((race) => {
              const hasTipped = tippedRaceIds.has(race.id);
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
                        <h4 className="font-semibold text-slate-900 truncate">
                          {race.raceNumber > 0 && `R${race.raceNumber} · `}
                          {race.name}
                        </h4>
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {race.distance}m
                        {race.grade && ` · ${race.grade}`}
                        {race.prizePool && ` · ${race.prizePool}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <TipButton status={race.status} hasTipped={hasTipped} />
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
      ))}
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

  if (status === "closed") {
    return (
      <span className="text-xs px-2 py-1 rounded font-medium bg-slate-100 text-slate-500">
        Locked
      </span>
    );
  }

  // upcoming / TBA
  return (
    <span className="text-xs px-2 py-1 rounded font-medium bg-slate-100 text-slate-500">
      TBA
    </span>
  );
}
