import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/admin/races — create a race within a round
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { roundId, name, venue, distance, raceTime, raceNumber, grade, raceType, prizePool, numPlacePositions } = body;

    if (!roundId || !name || !venue || !distance || !raceTime) {
      return NextResponse.json(
        { error: "roundId, name, venue, distance, and raceTime are required" },
        { status: 400 }
      );
    }

    const round = await prisma.round.findUnique({ where: { id: roundId } });
    if (!round) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    const race = await prisma.race.create({
      data: {
        roundId,
        name,
        venue,
        distance: parseInt(distance),
        raceTime: new Date(raceTime),
        raceNumber: raceNumber ? parseInt(raceNumber) : 0,
        grade: grade || "G1",
        raceType: raceType || null,
        prizePool: prizePool || null,
        numPlacePositions: numPlacePositions ? parseInt(numPlacePositions) : 3,
        status: "upcoming",
      },
    });

    return NextResponse.json({ race });
  } catch (error) {
    console.error("Create race error:", error);
    return NextResponse.json({ error: "Failed to create race" }, { status: 500 });
  }
}

// PATCH /api/admin/races — update race status or details
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { raceId, ...updates } = body;

    if (!raceId) {
      return NextResponse.json({ error: "raceId required" }, { status: 400 });
    }

    const race = await prisma.race.findUnique({ where: { id: raceId } });
    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    // Sanitize update fields
    const data: Record<string, unknown> = {};
    if (updates.name) data.name = updates.name;
    if (updates.venue) data.venue = updates.venue;
    if (updates.distance) data.distance = parseInt(updates.distance);
    if (updates.raceTime) data.raceTime = new Date(updates.raceTime);
    if (updates.raceNumber !== undefined) data.raceNumber = parseInt(updates.raceNumber);
    if (updates.grade) data.grade = updates.grade;
    if (updates.raceType !== undefined) data.raceType = updates.raceType || null;
    if (updates.prizePool !== undefined) data.prizePool = updates.prizePool || null;
    if (updates.status) {
      const validStatuses = ["upcoming", "open", "closed", "final", "abandoned"];
      if (!validStatuses.includes(updates.status)) {
        return NextResponse.json({ error: `status must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
      }
      data.status = updates.status;
    }
    if (updates.numPlacePositions) data.numPlacePositions = parseInt(updates.numPlacePositions);

    const updated = await prisma.race.update({
      where: { id: raceId },
      data,
    });

    return NextResponse.json({ race: updated });
  } catch (error) {
    console.error("Update race error:", error);
    return NextResponse.json({ error: "Failed to update race" }, { status: 500 });
  }
}

// DELETE /api/admin/races — delete a race (only if no tips submitted)
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { raceId } = await req.json();

    if (!raceId) {
      return NextResponse.json({ error: "raceId required" }, { status: 400 });
    }

    const tipCount = await prisma.tip.count({ where: { raceId } });
    if (tipCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete race with submitted tips" },
        { status: 400 }
      );
    }

    // Delete in transaction to prevent partial state
    await prisma.$transaction(async (tx) => {
      await tx.result.deleteMany({ where: { raceId } });
      await tx.runner.deleteMany({ where: { raceId } });
      await tx.race.delete({ where: { id: raceId } });
    });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Delete race error:", error);
    return NextResponse.json({ error: "Failed to delete race" }, { status: 500 });
  }
}
