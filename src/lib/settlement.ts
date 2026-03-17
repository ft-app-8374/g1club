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

  // Send result emails to all members (non-blocking)
  sendResultEmails(raceId, race.name, ledgerEntries).catch((err) =>
    console.error("Result email error:", err)
  );

  return {
    raceId,
    entriesCreated: ledgerEntries.length,
    settled: true,
  };
}

async function sendResultEmails(
  raceId: string,
  raceName: string,
  ledgerEntries: Array<{ userId: string; profit: number }>
) {
  // Get user details and calculate ranks
  const sorted = [...ledgerEntries].sort((a, b) => b.profit - a.profit);
  const users = await prisma.user.findMany({
    where: { id: { in: ledgerEntries.map((l) => l.userId) } },
    select: { id: true, username: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const user = userMap.get(entry.userId);
    if (!user) continue;

    const email = resultsEmail(
      user.username,
      raceName,
      entry.profit,
      i + 1,
      sorted.length
    );
    email.to = user.email;
    await sendEmail(email);
  }
}
