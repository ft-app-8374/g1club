import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InviteCodeGenerator } from "./invite-generator";
import { RaceManager } from "./race-manager";
import { ResultEntry } from "./result-entry";
import { AdminTabs } from "./admin-tabs";

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
                  select: { id: true, name: true, barrier: true, isScratched: true },
                  orderBy: { barrier: "asc" },
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

  // Races available for result entry
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

  // Members tab content
  const membersContent = (
    <div className="space-y-4">
      <div className="space-y-2">
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between text-sm bg-surface rounded-lg px-3 py-2"
          >
            <div>
              <span className="font-medium text-slate-900">{m.username}</span>
              <span className="text-slate-400 ml-2 text-xs">{m.email}</span>
            </div>
            <div className="flex items-center gap-2">
              {m.role === "admin" && (
                <span className="text-xs bg-gold-accent text-gold px-2 py-0.5 rounded font-medium">
                  Admin
                </span>
              )}
              <span
                className={`text-xs px-2 py-0.5 rounded font-medium ${
                  m.isFinancial
                    ? "bg-green-50 text-profit"
                    : "bg-red-50 text-loss"
                }`}
              >
                {m.isFinancial ? "Paid" : "Unpaid"}
              </span>
            </div>
          </div>
        ))}
      </div>

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
        resultsContent={<ResultEntry races={racesForResults} />}
        memberCount={members.length}
        raceCount={totalRaces}
      />
    </div>
  );
}
