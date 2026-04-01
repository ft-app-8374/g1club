import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCutoffForVenueOnDay } from "@/lib/cutoff";
import { TipForm } from "./tip-form";
import { AllTips } from "./all-tips";

export default async function RaceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const race = await prisma.race.findUnique({
    where: { id: params.id },
    include: {
      round: true,
      runners: { orderBy: { runnerNumber: "asc" } },
      results: { include: { runner: true }, orderBy: { finishPosition: "asc" } },
    },
  });

  if (!race) notFound();

  const myTip = await prisma.tip.findUnique({
    where: {
      userId_raceId: { userId: session.user.id, raceId: race.id },
    },
    include: {
      tipLines: {
        include: { runner: true, backupRunner: true },
      },
    },
  });

  const now = new Date();
  const venueCutoff = await getCutoffForVenueOnDay(race.venue, race.roundId);
  const cutoffPassed = venueCutoff ? now >= venueCutoff : false;
  const isSettled = race.status === "final";

  // All tips (visible after cutoff)
  let allTips: Awaited<ReturnType<typeof prisma.tip.findMany>> = [];
  if (cutoffPassed) {
    allTips = await prisma.tip.findMany({
      where: { raceId: race.id },
      include: {
        user: { select: { username: true } },
        tipLines: {
          include: { runner: true, backupRunner: true },
        },
      },
    });
  }

  // My ledger entry if settled
  const myLedger = isSettled
    ? await prisma.ledger.findUnique({
        where: {
          userId_raceId: { userId: session.user.id, raceId: race.id },
        },
      })
    : null;

  const activeRunners = race.runners.filter((r) => !r.isScratched);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <a
          href="/races"
          className="text-sm text-gold hover:text-gold-dark mb-2 inline-block font-medium"
        >
          &larr; Races
        </a>
        <h2 className="text-2xl font-bold text-slate-900">{race.name}</h2>
        <p className="text-slate-500">
          {race.venue} &middot; {race.distance}m &middot;{" "}
          {new Date(race.raceTime).toLocaleTimeString("en-AU", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "Australia/Sydney",
          })}
        </p>
        <div className="flex gap-2 mt-2">
          <span className="text-xs bg-surface text-slate-600 px-2 py-0.5 rounded">
            {race.grade}
          </span>
          {race.raceType && (
            <span className="text-xs bg-surface text-slate-600 px-2 py-0.5 rounded">
              {race.raceType}
            </span>
          )}
          {race.prizePool && (
            <span className="text-xs bg-surface text-slate-600 px-2 py-0.5 rounded">
              {race.prizePool}
            </span>
          )}
        </div>
      </div>

      {/* Cutoff countdown */}
      {!cutoffPassed && (
        <div className="bg-gold-accent border border-gold/30 rounded-card p-4">
          <p className="text-sm text-gold font-medium">
            {venueCutoff ? (
              <>Tips close ({race.venue}):{" "}
              {venueCutoff.toLocaleString("en-AU", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                timeZone: "Australia/Sydney",
            })}</>
            ) : (
              <>Lockout time TBC — tips are open</>
            )}
          </p>
          {venueCutoff && (
            <p className="text-xs text-slate-500 mt-1">
              First race at {race.venue}
            </p>
          )}
        </div>
      )}

      {cutoffPassed && !isSettled && (
        <div className="bg-red-50 border border-red-200 rounded-card p-4">
          <p className="text-sm text-loss font-medium">
            Tips locked — waiting for result
          </p>
        </div>
      )}

      {/* Results */}
      {isSettled && race.results.length > 0 && (
        <div className="bg-white rounded-card p-5 border border-surface-muted shadow-card">
          <h3 className="text-sm font-bold text-gold mb-3 uppercase tracking-wide">
            Result
          </h3>
          <div className="space-y-2">
            {race.results.slice(0, 4).map((r) => (
              <div key={r.id} className="flex justify-between text-sm">
                <span className="text-slate-800">
                  {r.finishPosition === 1
                    ? "🥇"
                    : r.finishPosition === 2
                      ? "🥈"
                      : r.finishPosition === 3
                        ? "🥉"
                        : `${r.finishPosition}th`}{" "}
                  {r.runner.name}
                </span>
                <span className="text-slate-500">
                  {r.winDividend ? `$${r.winDividend.toFixed(2)} W` : ""}
                  {r.placeDividend ? ` $${r.placeDividend.toFixed(2)} P` : ""}
                </span>
              </div>
            ))}
          </div>
          {myLedger && (
            <div className="mt-3 pt-3 border-t border-surface-muted">
              <span className="text-sm text-slate-700">Your P&L: </span>
              <span
                className={`font-bold ${myLedger.profit >= 0 ? "text-profit" : "text-loss"}`}
              >
                {myLedger.profit >= 0 ? "+" : ""}${myLedger.profit.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Field */}
      <div className="bg-white rounded-card p-5 border border-surface-muted shadow-card">
        <h3 className="text-sm font-bold text-gold mb-3 uppercase tracking-wide">
          Field ({activeRunners.length} runners)
        </h3>
        <div className="space-y-1">
          {race.runners.map((r) => (
            <div
              key={r.id}
              className={`flex items-center justify-between text-sm py-1 ${
                r.isScratched ? "opacity-40 line-through" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-6 text-center text-slate-400 text-xs">
                  {r.runnerNumber || "-"}
                </span>
                <span className={r.isScratched ? "text-slate-400" : "text-slate-800"}>
                  {r.name}
                </span>
                {r.isScratched && (
                  <span className="text-xs text-loss">SCR</span>
                )}
              </div>
              <div className="text-xs text-slate-400">
                {r.jockey && <span>{r.jockey}</span>}
                {r.weight && <span className="ml-2">{r.weight}kg</span>}
              </div>
            </div>
          ))}
        </div>
        {race.runners.length === 0 && (
          <p className="text-slate-400 text-sm">
            Fields not yet released for this race.
          </p>
        )}
      </div>

      {/* Tip Form (pre-cutoff only, with runners) */}
      {!cutoffPassed && activeRunners.length > 0 && (
        <TipForm
          raceId={race.id}
          cutoffAt={venueCutoff?.toISOString() || ""}
          runners={activeRunners.map((r) => ({
            id: r.id,
            name: r.name,
            barrier: r.barrier,
            runnerNumber: r.runnerNumber,
          }))}
          existingTip={
            myTip
              ? {
                  lines: myTip.tipLines.map((tl) => ({
                    runnerId: tl.runnerId,
                    backupRunnerId: tl.backupRunnerId || undefined,
                    betType: tl.betType as "win" | "place",
                    amount: tl.amount,
                  })),
                }
              : undefined
          }
        />
      )}

      {/* All Tips (post-cutoff) */}
      {cutoffPassed && allTips.length > 0 && (
        <AllTips
          tips={allTips.map((t) => ({
            username: (t as unknown as { user: { username: string } }).user
              .username,
            lines: (
              t as unknown as {
                tipLines: Array<{
                  betType: string;
                  amount: number;
                  runner: { name: string };
                  backupRunner: { name: string } | null;
                }>;
              }
            ).tipLines.map((tl) => ({
              betType: tl.betType,
              amount: tl.amount,
              runnerName: tl.runner.name,
              backupName: tl.backupRunner?.name,
            })),
          }))}
        />
      )}
    </div>
  );
}
