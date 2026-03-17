import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listMarketBook, betfairLogin } from "@/lib/betfair";

// POST /api/cron/check-scratchings
// Poll Betfair for scratched runners on race day
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const bfUser = process.env.BETFAIR_USERNAME;
    const bfPass = process.env.BETFAIR_PASSWORD;
    if (!bfUser || !bfPass) {
      return NextResponse.json(
        { error: "Betfair credentials not configured" },
        { status: 500 }
      );
    }

    await betfairLogin(bfUser, bfPass);

    // Find today's races that have Betfair market IDs
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const races = await prisma.race.findMany({
      where: {
        status: { in: ["open", "closed"] },
        betfairMarketId: { not: null },
        raceTime: { gte: todayStart, lte: todayEnd },
      },
      include: { runners: true },
    });

    if (races.length === 0) {
      return NextResponse.json({
        message: "No races to check today",
        scratchings: 0,
      });
    }

    let totalScratchings = 0;

    // Batch market book request
    const marketIds = races
      .map((r) => r.betfairMarketId)
      .filter(Boolean) as string[];

    const books = await listMarketBook({ marketIds });

    for (const book of books) {
      const race = races.find((r) => r.betfairMarketId === book.marketId);
      if (!race) continue;

      for (const bookRunner of book.runners) {
        if (bookRunner.status === "REMOVED") {
          // Find matching runner in our DB
          const runner = race.runners.find(
            (r) => r.betfairRunnerId === String(bookRunner.selectionId)
          );

          if (runner && !runner.isScratched) {
            await prisma.runner.update({
              where: { id: runner.id },
              data: {
                isScratched: true,
                scratchedAt: new Date(),
              },
            });
            totalScratchings++;

            // Auto-activate backup tips for affected users
            const affectedTipLines = await prisma.tipLine.findMany({
              where: {
                runnerId: runner.id,
                isBackupActive: false,
                backupRunnerId: { not: null },
                tip: { raceId: race.id },
              },
            });

            for (const tl of affectedTipLines) {
              // Check if backup is also scratched
              const backupRunner = tl.backupRunnerId
                ? await prisma.runner.findUnique({
                    where: { id: tl.backupRunnerId },
                  })
                : null;

              if (backupRunner && !backupRunner.isScratched) {
                await prisma.tipLine.update({
                  where: { id: tl.id },
                  data: {
                    isBackupActive: true,
                    effectiveRunnerId: tl.backupRunnerId,
                  },
                });
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      message: "Scratchings checked",
      racesChecked: races.length,
      newScratchings: totalScratchings,
    });
  } catch (error) {
    console.error("Check scratchings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
