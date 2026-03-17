import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { settleRace } from "@/lib/settlement";

// POST /api/admin/settle — manual result entry + settlement
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { raceId, results } = await req.json();

    if (!raceId || !results || !Array.isArray(results)) {
      return NextResponse.json(
        { error: "raceId and results array required" },
        { status: 400 }
      );
    }

    // Validate race exists
    const race = await prisma.race.findUnique({
      where: { id: raceId },
      include: { runners: true },
    });

    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    // Only allow settlement of closed races (or re-settlement of final races by explicit admin action)
    if (!["closed", "final"].includes(race.status)) {
      return NextResponse.json(
        { error: `Race must be closed before settlement (currently: ${race.status})` },
        { status: 400 }
      );
    }

    // Store results
    for (const r of results) {
      if (!r.runnerId || !r.finishPosition) {
        return NextResponse.json(
          { error: "Each result needs runnerId and finishPosition" },
          { status: 400 }
        );
      }

      // Validate dividend values
      if (r.winDividend !== undefined && r.winDividend !== null && (typeof r.winDividend !== "number" || r.winDividend < 0)) {
        return NextResponse.json(
          { error: "winDividend must be a non-negative number" },
          { status: 400 }
        );
      }
      if (r.placeDividend !== undefined && r.placeDividend !== null && (typeof r.placeDividend !== "number" || r.placeDividend < 0)) {
        return NextResponse.json(
          { error: "placeDividend must be a non-negative number" },
          { status: 400 }
        );
      }
      if (r.deadHeatFactor !== undefined && (typeof r.deadHeatFactor !== "number" || r.deadHeatFactor <= 0 || r.deadHeatFactor > 1)) {
        return NextResponse.json(
          { error: "deadHeatFactor must be between 0 and 1" },
          { status: 400 }
        );
      }

      await prisma.result.upsert({
        where: {
          raceId_runnerId: { raceId, runnerId: r.runnerId },
        },
        update: {
          finishPosition: r.finishPosition,
          winDividend: r.winDividend || null,
          placeDividend: r.placeDividend || null,
          isDeadHeat: r.isDeadHeat || false,
          deadHeatFactor: r.deadHeatFactor || 1.0,
          source: "manual",
        },
        create: {
          raceId,
          runnerId: r.runnerId,
          finishPosition: r.finishPosition,
          winDividend: r.winDividend || null,
          placeDividend: r.placeDividend || null,
          isDeadHeat: r.isDeadHeat || false,
          deadHeatFactor: r.deadHeatFactor || 1.0,
          source: "manual",
        },
      });
    }

    // Run settlement
    const settlement = await settleRace(raceId);

    return NextResponse.json({
      message: "Race settled manually",
      ...settlement,
    });
  } catch (error) {
    console.error("Manual settlement error:", error);
    return NextResponse.json(
      { error: "Settlement failed" },
      { status: 500 }
    );
  }
}
