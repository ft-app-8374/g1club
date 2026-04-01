import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/cron/lockout-check
// Finds races in the next 48 hours missing a race1StartTime (lockout time)
// and creates a FeedItem reminder so admins can set it before tips lock.
export async function POST(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // Find races within the next 48 hours that have no lockout time set
    // and are not already settled or abandoned
    const racesWithoutLockout = await prisma.race.findMany({
      where: {
        raceTime: { gte: now, lte: in48h },
        race1StartTime: null,
        status: { notIn: ["final", "abandoned"] },
      },
      include: { round: true },
      orderBy: { raceTime: "asc" },
    });

    if (racesWithoutLockout.length === 0) {
      return NextResponse.json({
        message: "All upcoming races have lockout times set",
        racesWithoutLockout: 0,
      });
    }

    // Avoid duplicate notifications — check if we already created one in the last 12 hours
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const existingReminder = await prisma.feedItem.findFirst({
      where: {
        type: "reminder",
        source: "system",
        title: "Lockout Time Required",
        createdAt: { gte: twelveHoursAgo },
      },
    });

    if (existingReminder) {
      return NextResponse.json({
        message: "Reminder already sent in the last 12 hours, skipping",
        racesWithoutLockout: racesWithoutLockout.length,
      });
    }

    // Build a summary of venues and races missing lockout times
    const venueMap = new Map<string, string[]>();
    for (const race of racesWithoutLockout) {
      const key = race.venue;
      if (!venueMap.has(key)) {
        venueMap.set(key, []);
      }
      const raceTime = race.raceTime.toISOString().replace("T", " ").slice(0, 16);
      venueMap.get(key)!.push(`${race.name} (R${race.raceNumber}, ${raceTime})`);
    }

    const lines: string[] = [];
    for (const [venue, races] of Array.from(venueMap.entries())) {
      lines.push(`**${venue}**`);
      for (const r of races) {
        lines.push(`  - ${r}`);
      }
    }

    const body = [
      `${racesWithoutLockout.length} race(s) in the next 48 hours have no lockout time (race1StartTime) set.`,
      `Tips cannot lock correctly without this. Please set via admin or re-run fetch-fields.`,
      "",
      ...lines,
    ].join("\n");

    await prisma.feedItem.create({
      data: {
        type: "reminder",
        source: "system",
        title: "Lockout Time Required",
        body,
        pinned: false,
      },
    });

    return NextResponse.json({
      message: `Created lockout reminder for ${racesWithoutLockout.length} race(s)`,
      racesWithoutLockout: racesWithoutLockout.length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Lockout check error:", msg);
    return NextResponse.json(
      { error: "Internal server error", detail: msg },
      { status: 500 }
    );
  }
}
