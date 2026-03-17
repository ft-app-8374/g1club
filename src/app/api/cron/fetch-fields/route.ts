import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  listMarketCatalogue,
  isGroup1Market,
  parseMarketName,
  betfairLogin,
} from "@/lib/betfair";

// POST /api/cron/fetch-fields
// Called by EventBridge (or manually) to pull fields from Betfair
export async function POST(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Login to Betfair
    const bfUser = process.env.BETFAIR_USERNAME;
    const bfPass = process.env.BETFAIR_PASSWORD;
    if (!bfUser || !bfPass) {
      return NextResponse.json(
        { error: "Betfair credentials not configured" },
        { status: 500 }
      );
    }

    await betfairLogin(bfUser, bfPass);

    // Find upcoming races in the next 7 days that need fields
    const now = new Date();
    const weekAhead = new Date(now);
    weekAhead.setDate(weekAhead.getDate() + 7);

    const races = await prisma.race.findMany({
      where: {
        status: "upcoming",
        raceTime: { gte: now, lte: weekAhead },
        runners: { none: {} }, // Only races with no runners yet
      },
      include: { round: true },
    });

    if (races.length === 0) {
      return NextResponse.json({ message: "No races need fields", updated: 0 });
    }

    let totalRunners = 0;

    for (const race of races) {
      // Search Betfair for matching market
      const dateStr = race.raceTime.toISOString().split("T")[0];
      const markets = await listMarketCatalogue({
        venues: [race.venue],
        dateFrom: `${dateStr}T00:00:00Z`,
        dateTo: `${dateStr}T23:59:59Z`,
        marketTypes: ["WIN"],
      });

      // Find matching market (by Grp1 tag or race name similarity)
      const match = markets.find(
        (m) =>
          isGroup1Market(m.marketName) ||
          m.marketName
            .toLowerCase()
            .includes(race.name.split(" ")[0].toLowerCase())
      );

      if (!match) continue;

      // Update race with Betfair market ID
      await prisma.race.update({
        where: { id: race.id },
        data: {
          betfairMarketId: match.marketId,
          status: "open",
        },
      });

      // Also try to find the PLACE market
      const placeMarkets = await listMarketCatalogue({
        venues: [race.venue],
        dateFrom: `${dateStr}T00:00:00Z`,
        dateTo: `${dateStr}T23:59:59Z`,
        marketTypes: ["PLACE"],
      });

      const placeMatch = placeMarkets.find((m) =>
        m.marketName.includes(
          parseMarketName(match.marketName).raceNumber?.toString() || ""
        )
      );

      if (placeMatch) {
        await prisma.race.update({
          where: { id: race.id },
          data: { betfairPlaceMarketId: placeMatch.marketId },
        });
      }

      // Insert runners
      for (const runner of match.runners) {
        await prisma.runner.upsert({
          where: {
            raceId_name: { raceId: race.id, name: runner.runnerName },
          },
          update: {
            betfairRunnerId: String(runner.selectionId),
            jockey: runner.metadata?.JOCKEY_NAME || null,
            trainer: runner.metadata?.TRAINER_NAME || null,
            weight: runner.metadata?.WEIGHT_VALUE
              ? parseFloat(runner.metadata.WEIGHT_VALUE)
              : null,
            barrier: runner.metadata?.STALL_DRAW
              ? parseInt(runner.metadata.STALL_DRAW)
              : null,
          },
          create: {
            raceId: race.id,
            betfairRunnerId: String(runner.selectionId),
            name: runner.runnerName,
            jockey: runner.metadata?.JOCKEY_NAME || null,
            trainer: runner.metadata?.TRAINER_NAME || null,
            weight: runner.metadata?.WEIGHT_VALUE
              ? parseFloat(runner.metadata.WEIGHT_VALUE)
              : null,
            barrier: runner.metadata?.STALL_DRAW
              ? parseInt(runner.metadata.STALL_DRAW)
              : null,
          },
        });
        totalRunners++;
      }
    }

    return NextResponse.json({
      message: "Fields fetched",
      racesChecked: races.length,
      runnersAdded: totalRunners,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Fetch fields error:", msg);
    return NextResponse.json(
      { error: "Internal server error", detail: msg },
      { status: 500 }
    );
  }
}
