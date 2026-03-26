import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCutoffForVenueOnDay } from "@/lib/cutoff";
import { InviteCodeGenerator } from "./invite-generator";
import { RaceManager } from "./race-manager";
import { ResultEntry } from "./result-entry";
import { MemberTips } from "./member-tips";
import { AdminTabs } from "./admin-tabs";
import { FeedPost } from "./feed-post";
import { getLatestFeed } from "@/lib/feed";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  if (session?.user.role !== "admin") {
    redirect("/dashboard");
  }

  const [members, carnival, inviteCodes] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isFinancial: true,
        createdAt: true,
      },
    }),
    prisma.carnival.findFirst({
      where: { status: { in: ["active", "upcoming"] } },
      include: {
        rounds: {
          include: {
            races: {
              include: {
                runners: {
                  select: { id: true, name: true, barrier: true, runnerNumber: true, isScratched: true },
                  orderBy: { runnerNumber: "asc" },
                },
              },
            },
          },
          orderBy: { number: "asc" },
        },
      },
    }),
    prisma.inviteCode.findMany({
      where: { usedBy: null },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  // Prepare rounds data for RaceManager
  const roundsData = carnival?.rounds.map((r) => ({
    id: r.id,
    number: r.number,
    name: r.name,
    raceDate: r.raceDate.toISOString(),
    races: r.races.map((race) => ({
      id: race.id,
      name: race.name,
      venue: race.venue,
      distance: race.distance,
      grade: race.grade,
      status: race.status,
      raceTime: race.raceTime.toISOString(),
      raceNumber: race.raceNumber,
      runners: race.runners.map((runner) => ({
        id: runner.id,
        name: runner.name,
        barrier: runner.barrier,
        isScratched: runner.isScratched,
      })),
    })),
  })) || [];

  // Races available for result entry + settled races with results
  const racesForResults = carnival?.rounds.flatMap((r) =>
    r.races.map((race) => ({
      id: race.id,
      name: race.name,
      venue: race.venue,
      status: race.status,
      runners: race.runners.map((runner) => ({
        id: runner.id,
        name: runner.name,
        barrier: runner.barrier,
        isScratched: runner.isScratched,
      })),
    }))
  ) || [];

  // Fetch results for settled races
  const settledResults = await prisma.result.findMany({
    where: {
      race: { status: "final" },
      raceId: { in: racesForResults.map((r) => r.id) },
    },
    include: {
      runner: { select: { name: true } },
      race: { select: { name: true, venue: true } },
    },
    orderBy: [{ raceId: "asc" }, { finishPosition: "asc" }],
  });

  // Group results by race
  const resultsByRace = new Map<string, typeof settledResults>();
  for (const result of settledResults) {
    const existing = resultsByRace.get(result.raceId) || [];
    existing.push(result);
    resultsByRace.set(result.raceId, existing);
  }

  const settledRaceResults = racesForResults
    .filter((r) => r.status === "final")
    .map((r) => ({
      ...r,
      results: (resultsByRace.get(r.id) || []).slice(0, 4).map((res) => ({
        position: res.finishPosition,
        name: res.runner.name,
        winDividend: res.winDividend,
        placeDividend: res.placeDividend,
      })),
    }));

  // Build per-user tip data for the active carnival
  // Flatten races but keep roundId context
  const allRacesWithRound = carnival?.rounds.flatMap((r) =>
    r.races.map((race) => ({ ...race, roundId: r.id }))
  ) || [];
  const now = new Date();

  // Compute cutoff status for each race
  const raceCutoffMap = new Map<string, boolean>();
  for (const race of allRacesWithRound) {
    const cutoff = await getCutoffForVenueOnDay(race.venue, race.raceTime, race.roundId);
    raceCutoffMap.set(race.id, now >= cutoff);
  }

  // Query all tips for races in this carnival
  const allTips = carnival
    ? await prisma.tip.findMany({
        where: {
          raceId: { in: allRacesWithRound.map((r) => r.id) },
        },
        include: {
          tipLines: {
            include: {
              runner: { select: { id: true, name: true, runnerNumber: true } },
              backupRunner: { select: { id: true, name: true, runnerNumber: true } },
            },
          },
        },
      })
    : [];

  // Build a map: userId -> array of tip data per race
  const tipsByUser = new Map<string, typeof allTips>();
  for (const tip of allTips) {
    const existing = tipsByUser.get(tip.userId) || [];
    existing.push(tip);
    tipsByUser.set(tip.userId, existing);
  }

  // Build member data with tips for MemberTips component
  const membersWithTips = members.map((m) => {
    const userTips = tipsByUser.get(m.id) || [];
    const userTipsByRace = new Map(userTips.map((t) => [t.raceId, t]));

    return {
      id: m.id,
      username: m.username,
      email: m.email,
      role: m.role,
      isFinancial: m.isFinancial,
      tips: allRacesWithRound.map((race) => {
        const tip = userTipsByRace.get(race.id);
        return {
          id: tip?.id || "",
          raceId: race.id,
          raceName: race.name,
          raceVenue: race.venue,
          raceStatus: race.status,
          cutoffPassed: raceCutoffMap.get(race.id) || false,
          tipLines: (tip?.tipLines || []).map((tl) => ({
            id: tl.id,
            runnerId: tl.runnerId,
            backupRunnerId: tl.backupRunnerId,
            betType: tl.betType,
            amount: tl.amount,
            runner: tl.runner,
            backupRunner: tl.backupRunner,
          })),
          runners: race.runners.map((r) => ({
            id: r.id,
            name: r.name,
            barrier: r.barrier,
            runnerNumber: r.runnerNumber,
            isScratched: r.isScratched,
          })),
        };
      }),
    };
  });

  // Members tab content
  const membersContent = (
    <div className="space-y-4">
      <MemberTips members={membersWithTips} />

      {/* Invite Codes */}
      <div className="pt-4 border-t border-surface-muted">
        <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
          Invite Codes
        </h4>
        <InviteCodeGenerator />
        {inviteCodes.length > 0 && (
          <div className="mt-3 space-y-1">
            {inviteCodes.map((ic) => (
              <div key={ic.id} className="flex justify-between text-sm">
                <code className="text-gold font-medium">{ic.code}</code>
                <span className="text-slate-400 text-xs">
                  expires{" "}
                  {new Date(ic.expiresAt).toLocaleDateString("en-AU")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Carnival stats
  const totalRaces = carnival?.rounds.reduce((n, r) => n + r.races.length, 0) || 0;
  const totalRunners = carnival?.rounds.reduce(
    (n, r) => n + r.races.reduce((m, race) => m + race.runners.length, 0),
    0
  ) || 0;

  const feedItems = await getLatestFeed(20);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900">Admin Panel</h2>
        {carnival && (
          <div className="text-right text-xs text-slate-500">
            <p>{carnival.name}</p>
            <p>{carnival.rounds.length} rounds &middot; {totalRaces} races &middot; {totalRunners} runners</p>
          </div>
        )}
      </div>

      <AdminTabs
        membersContent={membersContent}
        racesContent={<RaceManager rounds={roundsData} />}
        resultsContent={
          <div className="space-y-6">
            <ResultEntry races={racesForResults} />
            {settledRaceResults.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gold mb-3 uppercase tracking-wide">
                  Settled Results
                </h3>
                <div className="space-y-3">
                  {settledRaceResults.map((race) => (
                    <div key={race.id} className="bg-surface rounded-lg p-3 border border-surface-muted">
                      <p className="text-sm font-medium text-slate-900 mb-2">
                        {race.name} <span className="text-xs text-slate-400">{race.venue}</span>
                      </p>
                      {race.results.map((res) => (
                        <div key={res.position} className="flex justify-between text-xs text-slate-600">
                          <span>{res.position}. {res.name}</span>
                          <span>
                            {res.winDividend ? `W $${res.winDividend.toFixed(2)}` : ""}
                            {res.placeDividend ? ` P $${res.placeDividend.toFixed(2)}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        }
        feedContent={
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-gold mb-3 uppercase tracking-wide">
                New Post
              </h3>
              <FeedPost />
            </div>
            {feedItems.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gold mb-3 uppercase tracking-wide">
                  Recent Feed ({feedItems.length})
                </h3>
                <div className="space-y-2">
                  {feedItems.map((item) => (
                    <div key={item.id} className="bg-surface rounded-lg p-3 border border-surface-muted">
                      <div className="flex justify-between items-start">
                        <div>
                          {item.pinned && <span className="text-xs text-gold mr-1">pinned</span>}
                          <span className="text-xs text-slate-400 mr-2">
                            {item.type} &middot; {item.source}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(item.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "Australia/Sydney" })}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-slate-900 mt-1">{item.title}</p>
                      {item.body && <p className="text-xs text-slate-500 mt-1">{item.body}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        }
        memberCount={members.length}
        raceCount={totalRaces}
      />
    </div>
  );
}
