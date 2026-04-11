import { prisma } from "./prisma";
import { sendEmail, resultsEmail } from "./email";

export async function settleRace(raceId: string) {
  const race = await prisma.race.findUnique({
    where: { id: raceId },
    include: {
      round: { include: { carnival: true } },
      runners: true,
      results: true,
    },
  });

  if (!race) throw new Error(`Race ${raceId} not found`);
  if (race.results.length === 0)
    throw new Error(`No results for race ${raceId}`);

  // Get all users in the carnival
  const allUsers = await prisma.user.findMany({
    select: { id: true },
  });

  // Get all tips for this race
  const tips = await prisma.tip.findMany({
    where: { raceId },
    include: {
      tipLines: {
        include: {
          runner: true,
          backupRunner: true,
        },
      },
    },
  });

  const tipsByUser = new Map(tips.map((t) => [t.userId, t]));
  const resultsByRunner = new Map(
    race.results.map((r) => [r.runnerId, r])
  );
  const runnersById = new Map(race.runners.map((r) => [r.id, r]));

  const ledgerEntries: Array<{
    userId: string;
    raceId: string;
    tipId: string | null;
    stake: number;
    returns: number;
    profit: number;
    breakdown: string;
  }> = [];

  for (const user of allUsers) {
    const tip = tipsByUser.get(user.id);

    // No tip submitted = -$100
    if (!tip) {
      ledgerEntries.push({
        userId: user.id,
        raceId,
        tipId: null,
        stake: -100,
        returns: 0,
        profit: -100,
        breakdown: JSON.stringify([{ reason: "No tip submitted" }]),
      });
      continue;
    }

    let totalReturns = 0;
    const breakdown = [];

    for (const tipLine of tip.tipLines) {
      // Resolve effective runner (primary or backup if scratched)
      let effectiveRunner = runnersById.get(tipLine.runnerId)!;
      let backupUsed = false;

      if (effectiveRunner.isScratched && tipLine.backupRunnerId) {
        const backup = runnersById.get(tipLine.backupRunnerId);
        if (backup && !backup.isScratched) {
          effectiveRunner = backup;
          backupUsed = true;
        }
      }

      // If effective runner is scratched, no return
      if (effectiveRunner.isScratched) {
        breakdown.push({
          tipLineId: tipLine.id,
          horse: tipLine.runner.name,
          betType: tipLine.betType,
          amount: tipLine.amount,
          effectiveHorse: effectiveRunner.name,
          backupUsed,
          result: "scratched",
          return: 0,
        });
        continue;
      }

      const result = resultsByRunner.get(effectiveRunner.id);
      let lineReturn = 0;

      if (result) {
        if (
          tipLine.betType === "win" &&
          result.finishPosition === 1 &&
          result.winDividend
        ) {
          lineReturn = tipLine.amount * result.winDividend;
          if (result.isDeadHeat) {
            lineReturn *= result.deadHeatFactor;
          }
        } else if (
          tipLine.betType === "place" &&
          result.finishPosition <= race.numPlacePositions &&
          result.placeDividend
        ) {
          lineReturn = tipLine.amount * result.placeDividend;
          if (result.isDeadHeat) {
            lineReturn *= result.deadHeatFactor;
          }
        }
      }

      totalReturns += lineReturn;

      breakdown.push({
        tipLineId: tipLine.id,
        horse: tipLine.runner.name,
        betType: tipLine.betType,
        amount: tipLine.amount,
        effectiveHorse: effectiveRunner.name,
        backupUsed,
        finishPosition: result?.finishPosition,
        dividend:
          tipLine.betType === "win"
            ? result?.winDividend
            : result?.placeDividend,
        return: Math.round(lineReturn * 100) / 100,
      });

      // Update effective runner on tip line
      await prisma.tipLine.update({
        where: { id: tipLine.id },
        data: {
          effectiveRunnerId: effectiveRunner.id,
          isBackupActive: backupUsed,
        },
      });
    }

    const profit = Math.round((totalReturns - 100) * 100) / 100;

    ledgerEntries.push({
      userId: user.id,
      raceId,
      tipId: tip.id,
      stake: -100,
      returns: Math.round(totalReturns * 100) / 100,
      profit,
      breakdown: JSON.stringify(breakdown),
    });
  }

  // Write ledger entries in a transaction
  await prisma.$transaction(async (tx) => {
    // Delete existing ledger entries for this race (in case of re-settlement)
    await tx.ledger.deleteMany({ where: { raceId } });

    // Create new entries
    for (const entry of ledgerEntries) {
      await tx.ledger.create({ data: entry });
    }

    // Lock all tips
    await tx.tip.updateMany({
      where: { raceId },
      data: { status: "settled" },
    });

    // Mark race as final
    await tx.race.update({
      where: { id: raceId },
      data: { status: "final", settledAt: new Date() },
    });
  });

  // Check if all races in the round are now settled — if so, send consolidated results
  sendRoundResultsIfComplete(race.roundId).catch((err) =>
    console.error("Round result email error:", err)
  );

  return {
    raceId,
    entriesCreated: ledgerEntries.length,
    settled: true,
  };
}

async function sendRoundResultsIfComplete(roundId: string) {
  // Check if ALL races in the round are settled
  const allRaces = await prisma.race.findMany({
    where: { roundId, status: { not: "abandoned" } },
    select: { id: true, name: true, status: true, numPlacePositions: true },
    orderBy: { raceTime: "asc" },
  });

  const unsettled = allRaces.filter((r) => r.status !== "final");
  if (unsettled.length > 0) return; // Not all races settled yet

  // Check dedup
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    select: { name: true },
  });
  if (!round) return;

  const notifKey = `member-results-${roundId}`;
  const alreadySent = await prisma.notification.findFirst({
    where: { type: notifKey },
  });
  if (alreadySent) return;

  const raceIds = allRaces.map((r) => r.id);

  // Get all ledger entries for the round
  const ledgerEntries = await prisma.ledger.findMany({
    where: { raceId: { in: raceIds } },
    include: {
      tip: {
        include: {
          tipLines: {
            include: {
              runner: { select: { name: true } },
              effectiveRunner: { select: { name: true } },
            },
          },
        },
      },
      race: {
        select: {
          id: true,
          name: true,
          results: {
            include: { runner: { select: { name: true } } },
            orderBy: { finishPosition: "asc" },
          },
        },
      },
    },
  });

  // Group by user, sum profits
  const userRoundData = new Map<
    string,
    {
      totalProfit: number;
      races: Array<{
        name: string;
        profit: number;
        bets: Array<{
          horse: string;
          betType: string;
          amount: number;
          dividend: number | null;
          result: string;
        }>;
      }>;
    }
  >();

  for (const entry of ledgerEntries) {
    if (!userRoundData.has(entry.userId)) {
      userRoundData.set(entry.userId, { totalProfit: 0, races: [] });
    }
    const userData = userRoundData.get(entry.userId)!;
    userData.totalProfit += Number(entry.profit);

    // Build bet details for this race
    const bets: Array<{
      horse: string;
      betType: string;
      amount: number;
      dividend: number | null;
      result: string;
    }> = [];

    if (entry.tip) {
      for (const tl of entry.tip.tipLines) {
        const horseName = tl.effectiveRunner?.name || tl.runner.name;
        const raceResults = entry.race.results;
        const runnerResult = raceResults.find(
          (r) => r.runner.name === horseName
        );

        let resultText = "Lost";
        let dividend: number | null = null;
        if (runnerResult) {
          if (tl.betType === "win" && runnerResult.finishPosition === 1) {
            resultText = "Won";
            dividend = runnerResult.winDividend
              ? Number(runnerResult.winDividend)
              : null;
          } else if (
            tl.betType === "place" &&
            runnerResult.finishPosition <=
              (allRaces.find((r) => r.id === entry.raceId)
                ?.numPlacePositions || 3)
          ) {
            resultText = "Placed";
            dividend = runnerResult.placeDividend
              ? Number(runnerResult.placeDividend)
              : null;
          }
        }

        bets.push({
          horse: horseName,
          betType: tl.betType,
          amount: Number(tl.amount),
          dividend,
          result: resultText,
        });
      }
    } else {
      bets.push({
        horse: "—",
        betType: "—",
        amount: 100,
        dividend: null,
        result: "No tip",
      });
    }

    userData.races.push({
      name: entry.race.name,
      profit: Number(entry.profit),
      bets,
    });
  }

  // Get season totals for ranking (not just this round)
  const seasonLedger = await prisma.ledger.groupBy({
    by: ["userId"],
    _sum: { profit: true },
  });
  const seasonProfitByUser = new Map(
    seasonLedger.map((s) => [s.userId, Number(s._sum.profit || 0)])
  );

  // Build ranked list by SEASON total
  const ranked = Array.from(userRoundData.entries())
    .map(([userId, data]) => ({
      userId,
      roundProfit: Math.round(data.totalProfit * 100) / 100,
      seasonProfit: Math.round((seasonProfitByUser.get(userId) || 0) * 100) / 100,
      races: data.races,
    }))
    .sort((a, b) => b.seasonProfit - a.seasonProfit);

  // Get user details
  const users = await prisma.user.findMany({
    where: { id: { in: ranked.map((r) => r.userId) } },
    select: { id: true, username: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  // Send consolidated email to each user
  for (let i = 0; i < ranked.length; i++) {
    const entry = ranked[i];
    const user = userMap.get(entry.userId);
    if (!user) continue;

    const email = resultsEmail(
      user.username,
      round.name,
      entry.roundProfit,
      i + 1,
      ranked.length,
      entry.races
    );
    email.to = user.email;
    await sendEmail(email);
  }

  // Mark as sent
  await prisma.notification.create({
    data: {
      userId: ranked[0]?.userId || "system",
      type: notifKey,
      title: `Results sent: ${round.name}`,
      body: `${ranked.length} members`,
      isRead: true,
    },
  });
}
