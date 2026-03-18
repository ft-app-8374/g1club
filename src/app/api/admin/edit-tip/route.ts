import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/admin/edit-tip — admin override to create/update a user's tip
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { userId, raceId, lines } = await req.json();

    if (!userId || !raceId || !Array.isArray(lines)) {
      return NextResponse.json(
        { error: "userId, raceId, and lines are required" },
        { status: 400 }
      );
    }

    // Validate race exists
    const race = await prisma.race.findUnique({
      where: { id: raceId },
      include: {
        runners: { where: { isScratched: false } },
      },
    });

    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    // Admin can edit regardless of race status or cutoff — that's the point

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

    // Check no duplicate primary runners
    const primaryRunners = lines.map((l: { runnerId: string }) => l.runnerId);
    if (new Set(primaryRunners).size !== primaryRunners.length) {
      return NextResponse.json(
        { error: "Cannot select the same horse in multiple bets" },
        { status: 400 }
      );
    }

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Upsert tip with lines (delete old lines, create new)
    const tip = await prisma.$transaction(async (tx) => {
      // Delete existing tip if any
      const existing = await tx.tip.findUnique({
        where: { userId_raceId: { userId, raceId } },
      });

      if (existing) {
        await tx.tipLine.deleteMany({ where: { tipId: existing.id } });
        await tx.tip.delete({ where: { id: existing.id } });
      }

      // Create new tip with lines
      return tx.tip.create({
        data: {
          userId,
          raceId,
          tipLines: {
            create: lines.map(
              (l: {
                runnerId: string;
                backupRunnerId?: string | null;
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
    console.error("Admin edit-tip error:", error);
    return NextResponse.json(
      { error: "Failed to update tip" },
      { status: 500 }
    );
  }
}
