import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/admin/members — update member role or financial status
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { userId, role, isFinancial } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    // Prevent self-demotion
    if (userId === session.user.id && role && role !== "admin") {
      return NextResponse.json(
        { error: "Cannot demote yourself" },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = {};
    if (role !== undefined) {
      if (!["member", "admin"].includes(role)) {
        return NextResponse.json({ error: "role must be 'member' or 'admin'" }, { status: 400 });
      }
      data.role = role;
    }
    if (isFinancial !== undefined) {
      if (typeof isFinancial !== "boolean") {
        return NextResponse.json({ error: "isFinancial must be a boolean" }, { status: 400 });
      }
      data.isFinancial = isFinancial;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, username: true, role: true, isFinancial: true },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Update member error:", error);
    return NextResponse.json({ error: "Failed to update member" }, { status: 500 });
  }
}
