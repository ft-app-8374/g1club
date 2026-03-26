import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/admin/feed — create a new admin post
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title, body, pinned } = await req.json();

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const item = await prisma.feedItem.create({
    data: {
      type: "post",
      title: title.trim(),
      body: body?.trim() || null,
      source: "admin",
      pinned: !!pinned,
    },
  });

  return NextResponse.json({ id: item.id, message: "Post created" });
}

// DELETE /api/admin/feed — delete a feed item
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  await prisma.feedItem.delete({ where: { id } });
  return NextResponse.json({ message: "Deleted" });
}
