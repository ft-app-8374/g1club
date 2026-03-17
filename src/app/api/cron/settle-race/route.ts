import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listMarketBook, betfairLogin } from "@/lib/betfair";
import { settleRace } from "@/lib/settlement";

// POST /api/cron/settle-race
// Poll Betfair for results + BSP after race, then settle
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

    // Find races that are closed (post-jump) but not yet settled
    const races = await prisma.race.findMany({
      where: {
        status: "closed",
        betfairMarketId: { not: null },
      },
      include: { runners: true },
    });

    if (races.length === 0) {
      return NextResponse.json({ message: "No races to settle", settled: 0 });
    }

    let settledCount = 0;

    for (const race of races) {
      // Check WIN market
      const winBooks = await listMarketBook({
        marketIds: [race.betfairMarketId!],
        includeSP: true,
      });

      const winBook = winBooks[0];
      if (!winBook || winBook.status !== "CLOSED") continue;

      // Get PLACE market BSPs if available
      let placeBook = null;
      if (race.betfairPlaceMarketId) {
        const placeBooks = await listMarketBook({
          marketIds: [race.betfairPlaceMarketId],
          includeSP: true,
        });
        placeBook = placeBooks[0];
      }

      // Build results
      const results = [];
      let position = 1;

      // Sort by status (WINNER first, then LOSER, then REMOVED)
      const sortedRunners = [...winBook.runners].sort((a, b) => {
        if (a.status === "WINNER") return -1;
        if (b.status === "WINNER") return 1;
        return 0;
      });

      for (const bookRunner of sortedRunners) {
        const dbRunner = race.runners.find(
          (r) => r.betfairRunnerId === String(bookRunner.selectionId)
        );
        if (!dbRunner) continue;

        if (bookRunner.status === "REMOVED") continue;

        const isWinner = bookRunner.status === "WINNER";
        const winBSP = isWinner ? bookRunner.sp?.nearPrice || null : null;

        // Find place BSP
        let placeBSP = null;
        if (placeBook) {
          const placeRunner = placeBook.runners.find(
            (r) => r.selectionId === bookRunner.selectionId
          );
          if (
            placeRunner &&
            placeRunner.status === "WINNER" &&
            placeRunner.sp?.nearPrice
          ) {
            placeBSP = placeRunner.sp.nearPrice;
          }
        }

        results.push({
          raceId: race.id,
          runnerId: dbRunner.id,
          finishPosition: isWinner ? 1 : ++position,
          winDividend: winBSP,
          placeDividend: placeBSP,
          source: "betfair",
        });
      }

      if (results.length === 0) continue;

      // Store results
      for (const result of results) {
        await prisma.result.upsert({
          where: {
            raceId_runnerId: {
              raceId: result.raceId,
              runnerId: result.runnerId,
            },
          },
          update: result,
          create: result,
        });
      }

      // Run settlement
      await settleRace(race.id);
      settledCount++;
    }

    return NextResponse.json({
      message: "Settlement check complete",
      racesChecked: races.length,
      settled: settledCount,
    });
  } catch (error) {
    console.error("Settle race error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
