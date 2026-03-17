import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/admin/runners — add runners to a race
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { raceId, runners } = await req.json();

    if (!raceId || !runners || !Array.isArray(runners)) {
      return NextResponse.json(
        { error: "raceId and runners array required" },
        { status: 400 }
      );
    }

    const race = await prisma.race.findUnique({ where: { id: raceId } });
    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    let added = 0;
    for (const r of runners) {
      if (!r.name) continue;
      await prisma.runner.upsert({
        where: { raceId_name: { raceId, name: r.name } },
        update: {
          barrier: r.barrier ? parseInt(r.barrier) : null,
          jockey: r.jockey || null,
          trainer: r.trainer || null,
          weight: r.weight ? parseFloat(r.weight) : null,
        },
        create: {
          raceId,
          name: r.name,
          barrier: r.barrier ? parseInt(r.barrier) : null,
          jockey: r.jockey || null,
          trainer: r.trainer || null,
          weight: r.weight ? parseFloat(r.weight) : null,
        },
      });
      added++;
    }

    return NextResponse.json({ added });
  } catch (error) {
    console.error("Add runners error:", error);
    return NextResponse.json({ error: "Failed to add runners" }, { status: 500 });
  }
}

// PATCH /api/admin/runners — scratch/unscratch a runner
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { runnerId, isScratched } = await req.json();

    if (!runnerId || isScratched === undefined) {
      return NextResponse.json(
        { error: "runnerId and isScratched required" },
        { status: 400 }
      );
    }

    const runner = await prisma.runner.update({
      where: { id: runnerId },
      data: {
        isScratched,
        scratchedAt: isScratched ? new Date() : null,
      },
    });

    return NextResponse.json({ runner });
  } catch (error) {
    console.error("Update runner error:", error);
    return NextResponse.json({ error: "Failed to update runner" }, { status: 500 });
  }
}
