import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/admin/carnival — update carnival or round status
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await req.json();

    // Update carnival status
    if (body.carnivalId && body.status) {
      const validStatuses = ["upcoming", "active", "completed"];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: `Carnival status must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
      }
      const carnival = await prisma.carnival.update({
        where: { id: body.carnivalId },
        data: { status: body.status },
      });
      return NextResponse.json({ carnival });
    }

    // Update round cutoff
    if (body.roundId) {
      const data: Record<string, unknown> = {};
      if (body.cutoffAt) data.cutoffAt = new Date(body.cutoffAt);
      if (body.status) {
        const validStatuses = ["upcoming", "open", "locked", "settled"];
        if (!validStatuses.includes(body.status)) {
          return NextResponse.json({ error: `Round status must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
        }
        data.status = body.status;
      }

      const round = await prisma.round.update({
        where: { id: body.roundId },
        data,
      });
      return NextResponse.json({ round });
    }

    return NextResponse.json({ error: "carnivalId or roundId required" }, { status: 400 });
  } catch (error) {
    console.error("Update carnival error:", error);
    return NextResponse.json({ error: "Failed to update carnival" }, { status: 500 });
  }
}
