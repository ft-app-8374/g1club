import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/cron/close-tips
// Locks tips 30 minutes before the first race at each venue.
// Each venue has its own cutoff — if Flemington R1 is 12:00pm and
// Randwick R1 is 12:30pm, Flemington tips lock at 11:30am and
// Randwick tips lock at 12:00pm.
//
// Should run every 5 minutes on race days.
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const CUTOFF_MINUTES = 30;

    // Find all open races today (use Sydney timezone for day boundaries)
    const sydneyNow = new Date(now.toLocaleString("en-US", { timeZone: "Australia/Sydney" }));
    const startOfDay = new Date(sydneyNow);
    startOfDay.setHours(0, 0, 0, 0);
    // Convert back to UTC for DB query
    const offsetMs = sydneyNow.getTime() - now.getTime();
    const startOfDayUTC = new Date(startOfDay.getTime() - offsetMs);
    const endOfDayUTC = new Date(startOfDayUTC.getTime() + 24 * 60 * 60 * 1000 - 1);

    const todaysRaces = await prisma.race.findMany({
      where: {
        status: "open",
        raceTime: { gte: startOfDayUTC, lte: endOfDayUTC },
      },
      select: { id: true, venue: true, raceTime: true, roundId: true, race1StartTime: true },
      orderBy: { raceTime: "asc" },
    });

    if (todaysRaces.length === 0) {
      return NextResponse.json({ message: "No open races today", locked: 0 });
    }

    // Group by venue+round, use race1StartTime (R1 at venue) for cutoff
    const venueCutoffTime = new Map<string, Date>();
    const venueRaceIds = new Map<string, string[]>();

    for (const race of todaysRaces) {
      const key = `${race.venue}:${race.roundId}`;
      // Prefer race1StartTime (actual R1 at venue), fall back to earliest raceTime
      if (!venueCutoffTime.has(key)) {
        venueCutoffTime.set(key, race.race1StartTime || race.raceTime);
      }
      const ids = venueRaceIds.get(key) || [];
      ids.push(race.id);
      venueRaceIds.set(key, ids);
    }

    let tipsLocked = 0;
    let racesUpdated = 0;
    const venuesLocked: string[] = [];

    for (const key of Array.from(venueCutoffTime.keys())) {
      const r1Time = venueCutoffTime.get(key)!;
      const cutoff = new Date(r1Time);
      cutoff.setMinutes(cutoff.getMinutes() - CUTOFF_MINUTES);

      // If we're past the cutoff for this venue, lock everything
      if (now >= cutoff) {
        const raceIds = venueRaceIds.get(key) || [];
        const venue = key.split(":")[0];

        // Lock all tips for races at this venue
        const result = await prisma.tip.updateMany({
          where: {
            raceId: { in: raceIds },
            status: "active",
          },
          data: { status: "locked" },
        });
        tipsLocked += result.count;

        // Mark races as closed
        await prisma.race.updateMany({
          where: {
            id: { in: raceIds },
            status: "open",
          },
          data: { status: "closed" },
        });
        racesUpdated += raceIds.length;
        venuesLocked.push(venue);
      }
    }

    return NextResponse.json({
      message: "Tip close check complete",
      venuesChecked: venueCutoffTime.size,
      venuesLocked,
      tipsLocked,
      racesUpdated,
    });
  } catch (error) {
    console.error("Close tips error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
