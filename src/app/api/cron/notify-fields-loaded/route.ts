import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, fieldsLoadedEmail } from "@/lib/email";

// POST /api/cron/notify-fields-loaded
// Called by betfair_fetch.py after successful sync.
// Sends admin email confirming fields are loaded + tipping open + countdown set.
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { roundId } = body;

    if (!roundId) {
      return NextResponse.json(
        { error: "roundId required" },
        { status: 400 }
      );
    }

    // Check dedup
    const notifKey = `fields-loaded-${roundId}`;
    const alreadySent = await prisma.notification.findFirst({
      where: { type: notifKey },
    });
    if (alreadySent) {
      return NextResponse.json({ message: "Already sent", sent: 0 });
    }

    // Get round with races and runners
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        races: {
          where: { status: { not: "abandoned" } },
          include: { _count: { select: { runners: true } } },
          orderBy: { raceTime: "asc" },
        },
      },
    });

    if (!round) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    // Build race info
    const races = round.races.map((r) => ({
      name: r.name,
      venue: r.venue,
      raceNumber: r.raceNumber,
      runnerCount: r._count.runners,
    }));

    // Calculate cutoff time
    const firstRace1Start = round.races.find((r) => r.race1StartTime);
    const cutoffTime = firstRace1Start?.race1StartTime
      ? new Date(firstRace1Start.race1StartTime).toLocaleString("en-AU", {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
          timeZone: "Australia/Sydney",
        })
      : "Not yet set";

    // Calculate countdown
    let cutoffCountdown = "Countdown not available";
    if (firstRace1Start?.race1StartTime) {
      const msLeft =
        new Date(firstRace1Start.race1StartTime).getTime() - Date.now();
      if (msLeft > 0) {
        const hours = Math.floor(msLeft / (1000 * 60 * 60));
        const mins = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
        cutoffCountdown = `${hours}h ${mins}m until lockout`;
      } else {
        cutoffCountdown = "Lockout has passed";
      }
    }

    // Send to admins
    const admins = await prisma.user.findMany({
      where: { role: "admin" },
      select: { id: true, username: true, email: true },
    });

    let sent = 0;
    for (const admin of admins) {
      const email = fieldsLoadedEmail(
        admin.username,
        round.name,
        races,
        cutoffTime,
        cutoffCountdown
      );
      email.to = admin.email;
      const ok = await sendEmail(email);
      if (ok) sent++;
    }

    await prisma.notification.create({
      data: {
        userId: admins[0]?.id || "system",
        type: notifKey,
        title: `Fields loaded: ${round.name}`,
        body: `${races.length} races, ${races.reduce((s, r) => s + r.runnerCount, 0)} runners`,
        isRead: true,
      },
    });

    return NextResponse.json({
      message: "Fields loaded notification sent",
      sent,
      races: races.length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Notify fields loaded error:", msg);

    // Send failure alert to admins
    try {
      const admins = await prisma.user.findMany({
        where: { role: "admin" },
        select: { email: true },
      });
      for (const admin of admins) {
        await sendEmail({
          to: admin.email,
          subject: "⚠️ ACTION NEEDED — Fields Loaded Notification Failed",
          html: `<div style="font-family: sans-serif; padding: 20px; background: #1a1a2e; color: #e2e8f0;">
            <h2 style="color: #ef4444;">Fields Notification Error</h2>
            <p>Fields were loaded but the admin notification failed:</p>
            <pre style="background: #0d1117; padding: 12px; border-radius: 4px; color: #f97316;">${msg}</pre>
          </div>`,
        });
      }
    } catch {
      // Last resort — just log
    }

    return NextResponse.json(
      { error: "Internal server error", detail: msg },
      { status: 500 }
    );
  }
}
