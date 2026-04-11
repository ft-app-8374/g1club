import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, tipConfirmationEmail } from "@/lib/email";

// POST /api/admin/send-tip-confirmation
// Admin/cron endpoint to manually trigger tip confirmation emails
// for users who have tipped all races in a round
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { roundId } = await req.json();
    if (!roundId) {
      return NextResponse.json({ error: "roundId required" }, { status: 400 });
    }

    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        races: {
          where: { status: { not: "abandoned" } },
          select: { id: true, name: true },
          orderBy: { raceTime: "asc" },
        },
      },
    });

    if (!round) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    const raceIds = round.races.map((r) => r.id);

    // Find all users with tips in this round
    const tips = await prisma.tip.findMany({
      where: { raceId: { in: raceIds } },
      include: {
        user: { select: { id: true, username: true, email: true } },
        race: { select: { name: true } },
        tipLines: {
          include: {
            runner: { select: { name: true } },
            backupRunner: { select: { name: true } },
          },
        },
      },
    });

    // Group by user
    const byUser = new Map<
      string,
      { username: string; email: string; tips: typeof tips }
    >();
    for (const tip of tips) {
      if (!byUser.has(tip.userId)) {
        byUser.set(tip.userId, {
          username: tip.user.username,
          email: tip.user.email,
          tips: [],
        });
      }
      byUser.get(tip.userId)!.tips.push(tip);
    }

    let sent = 0;
    const results: Array<{ username: string; email: string; status: string }> = [];

    for (const [, data] of Array.from(byUser.entries())) {
      // Only send to users who have tipped ALL races
      if (data.tips.length < raceIds.length) {
        results.push({
          username: data.username,
          email: data.email,
          status: `${data.tips.length}/${raceIds.length} tipped — skipped`,
        });
        continue;
      }

      const tipSummary = data.tips.map((t) => ({
        raceName: t.race.name,
        lines: t.tipLines.map((tl) => ({
          horse: tl.runner.name,
          betType: tl.betType,
          amount: Number(tl.amount),
          backup: tl.backupRunner?.name,
        })),
      }));

      const email = tipConfirmationEmail(data.username, round.name, tipSummary);
      email.to = data.email;
      const ok = await sendEmail(email);
      if (ok) sent++;
      results.push({
        username: data.username,
        email: data.email,
        status: ok ? "sent" : "failed",
      });
    }

    return NextResponse.json({ sent, results });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Send tip confirmation error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
