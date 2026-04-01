import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCutoffForVenueOnDay } from "@/lib/cutoff";

// GET - fetch user's tips for a race
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const raceId = searchParams.get("raceId");

  if (!raceId) {
    return NextResponse.json(
      { error: "raceId is required" },
      { status: 400 }
    );
  }

  const tip = await prisma.tip.findUnique({
    where: { userId_raceId: { userId: session.user.id, raceId } },
    include: {
      tipLines: {
        include: {
          runner: true,
          backupRunner: true,
        },
      },
    },
  });

  return NextResponse.json({ tip });
}

// POST - submit or update tips for a race
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { raceId, lines } = await req.json();

    if (!raceId || !lines || !Array.isArray(lines)) {
      return NextResponse.json(
        { error: "raceId and lines are required" },
        { status: 400 }
      );
    }

    // Validate race exists and is open
    const race = await prisma.race.findUnique({
      where: { id: raceId },
      include: {
        round: true,
        runners: { where: { isScratched: false } },
      },
    });

    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    // Race must be in 'open' or 'upcoming' status to accept tips
    if (!["open", "upcoming"].includes(race.status)) {
      return NextResponse.json(
        { error: "Tips are locked — race is " + race.status },
        { status: 400 }
      );
    }

    // Check per-venue cutoff (Race 1 jump time at this track)
    const now = new Date();
    const cutoff = await getCutoffForVenueOnDay(race.venue, race.roundId);
    if (cutoff && now >= cutoff) {
      return NextResponse.json(
        { error: "Tips are locked — cutoff has passed for this venue" },
        { status: 400 }
      );
    }

    // Validate lines
    if (lines.length > 4) {
      return NextResponse.json(
        { error: "Maximum 4 bets per race" },
        { status: 400 }
      );
    }

    const totalAmount = lines.reduce(
      (sum: number, l: { amount: number }) => sum + l.amount,
      0
    );
    if (Math.abs(totalAmount - 100) > 0.01) {
      return NextResponse.json(
        { error: `Bets must total exactly $100 (got $${totalAmount.toFixed(2)})` },
        { status: 400 }
      );
    }

    const validRunnerIds = new Set(race.runners.map((r) => r.id));

    for (const line of lines) {
      if (!line.runnerId || !line.betType || !line.amount) {
        return NextResponse.json(
          { error: "Each line needs runnerId, betType, and amount" },
          { status: 400 }
        );
      }

      if (!["win", "place"].includes(line.betType)) {
        return NextResponse.json(
          { error: "betType must be 'win' or 'place'" },
          { status: 400 }
        );
      }

      if (typeof line.amount !== "number" || !isFinite(line.amount) || line.amount <= 0) {
        return NextResponse.json(
          { error: "Amount must be a positive number" },
          { status: 400 }
        );
      }

      if (!validRunnerIds.has(line.runnerId)) {
        return NextResponse.json(
          { error: `Runner ${line.runnerId} is not valid or scratched` },
          { status: 400 }
        );
      }

      if (line.backupRunnerId && !validRunnerIds.has(line.backupRunnerId)) {
        return NextResponse.json(
          { error: `Backup runner ${line.backupRunnerId} is not valid or scratched` },
          { status: 400 }
        );
      }

      if (line.backupRunnerId === line.runnerId) {
        return NextResponse.json(
          { error: "Backup runner must be different from primary" },
          { status: 400 }
        );
      }
    }

    // Check no duplicate runner + bet type combos (same horse win + place is OK)
    const runnerBetKeys = lines.map(
      (l: { runnerId: string; betType: string }) => `${l.runnerId}:${l.betType}`
    );
    if (new Set(runnerBetKeys).size !== runnerBetKeys.length) {
      return NextResponse.json(
        { error: "Cannot place the same bet type on the same horse twice" },
        { status: 400 }
      );
    }

    // Upsert tip with lines (delete old lines, create new)
    const tip = await prisma.$transaction(async (tx) => {
      // Delete existing tip if any
      const existing = await tx.tip.findUnique({
        where: { userId_raceId: { userId: session.user.id, raceId } },
      });

      if (existing) {
        await tx.tipLine.deleteMany({ where: { tipId: existing.id } });
        await tx.tip.delete({ where: { id: existing.id } });
      }

      // Create new tip with lines
      return tx.tip.create({
        data: {
          userId: session.user.id,
          raceId,
          tipLines: {
            create: lines.map(
              (l: {
                runnerId: string;
                backupRunnerId?: string;
                betType: string;
                amount: number;
              }) => ({
                runnerId: l.runnerId,
                backupRunnerId: l.backupRunnerId || null,
                betType: l.betType,
                amount: l.amount,
                effectiveRunnerId: l.runnerId,
              })
            ),
          },
        },
        include: {
          tipLines: {
            include: { runner: true, backupRunner: true },
          },
        },
      });
    });

    return NextResponse.json({ tip });
  } catch (error) {
    console.error("Tip submission error:", error);
    return NextResponse.json(
      { error: "Failed to submit tips" },
      { status: 500 }
    );
  }
}

// DELETE - remove tip for a race
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const raceId = searchParams.get("raceId");

  if (!raceId) {
    return NextResponse.json(
      { error: "raceId is required" },
      { status: 400 }
    );
  }

  // Check race status and cutoff
  const race = await prisma.race.findUnique({
    where: { id: raceId },
    select: { id: true, status: true, venue: true, raceTime: true, roundId: true },
  });

  if (!race) {
    return NextResponse.json({ error: "Race not found" }, { status: 404 });
  }

  if (!["open", "upcoming"].includes(race.status)) {
    return NextResponse.json(
      { error: "Tips are locked — race is " + race.status },
      { status: 400 }
    );
  }

  const cutoff = await getCutoffForVenueOnDay(race.venue, race.roundId);
  if (cutoff && new Date() >= cutoff) {
    return NextResponse.json(
      { error: "Tips are locked — cutoff has passed for this venue" },
      { status: 400 }
    );
  }

  const existing = await prisma.tip.findUnique({
    where: { userId_raceId: { userId: session.user.id, raceId } },
  });

  if (existing) {
    await prisma.$transaction(async (tx) => {
      await tx.tipLine.deleteMany({ where: { tipId: existing.id } });
      await tx.tip.delete({ where: { id: existing.id } });
    });
  }

  return NextResponse.json({ success: true });
}
