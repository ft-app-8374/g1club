import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const code = crypto.randomBytes(6).toString("hex").toUpperCase();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const invite = await prisma.inviteCode.create({
    data: {
      code,
      createdBy: session.user.id,
      expiresAt,
    },
  });

  return NextResponse.json({ code: invite.code, expiresAt: invite.expiresAt });
}
