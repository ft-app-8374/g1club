import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/cron/open-races
// Automatically opens "upcoming" races that are 3-4 days away
// This triggers the betting-open notification in the send-notifications cron
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const openWindow = new Date(now);
    openWindow.setDate(openWindow.getDate() + 4); // Open races 4 days out

    // Find upcoming races within the window that have runners
    const races = await prisma.race.findMany({
      where: {
        status: "upcoming",
        raceTime: { lte: openWindow },
        runners: { some: {} }, // Must have at least one runner
      },
      include: {
        _count: { select: { runners: true } },
      },
    });

    let opened = 0;
    for (const race of races) {
      await prisma.race.update({
        where: { id: race.id },
        data: { status: "open" },
      });
      opened++;
    }

    return NextResponse.json({
      message: "Race open check complete",
      checked: races.length,
      opened,
    });
  } catch (error) {
    console.error("Open races error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
