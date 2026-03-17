import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVenueCutoffs } from "@/lib/cutoff";
import {
  sendEmail,
  bettingOpenEmail,
  tipReminderEmail,
} from "@/lib/email";

// POST /api/cron/send-notifications
// Called every 30 minutes by EventBridge (or cron)
// Handles:
//   1. Betting open notification (when races move to "open" status)
//   2. 3-hour reminder for untipped members (per venue cutoff)
//   3. 1-hour final reminder for untipped members (per venue cutoff)
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const results = { bettingOpen: 0, reminder3h: 0, reminder1h: 0 };

    // Get active carnival with rounds
    const carnival = await prisma.carnival.findFirst({
      where: { status: { in: ["active", "upcoming"] } },
      include: {
        rounds: {
          include: {
            races: {
              where: { status: { not: "abandoned" } },
              select: { id: true, name: true, venue: true, raceTime: true, status: true },
            },
          },
          orderBy: { number: "asc" },
        },
      },
    });

    if (!carnival) {
      return NextResponse.json({ message: "No active carnival", ...results });
    }

    // Get all financial members
    const members = await prisma.user.findMany({
      where: { isFinancial: true },
      select: { id: true, username: true, email: true },
    });

    // Get all existing tips
    const allTips = await prisma.tip.findMany({
      select: { userId: true, raceId: true },
    });
    const tippedSet = new Set(allTips.map((t) => `${t.userId}:${t.raceId}`));

    for (const round of carnival.rounds) {
      const openRaces = round.races.filter((r) => r.status === "open");
      if (openRaces.length === 0) continue;

      // Get per-venue cutoffs for this round
      const venueCutoffs = await getVenueCutoffs(round.id);

      // --- 1. Betting Open Notification ---
      const bettingOpenKey = `betting-open-round-${round.id}`;
      const alreadyNotified = await prisma.notification.findFirst({
        where: { type: bettingOpenKey },
      });

      if (!alreadyNotified) {
        // Format all venue cutoffs for the email
        const cutoffLines: string[] = [];
        for (const venue of Array.from(venueCutoffs.keys())) {
        const cutoff = venueCutoffs.get(venue)!;
          cutoffLines.push(`${venue}: ${cutoff.toLocaleString("en-AU", {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
            timeZone: "Australia/Sydney",
          })}`);
        }
        const cutoffFormatted = cutoffLines.join(" | ");

        for (const member of members) {
          const email = bettingOpenEmail(
            member.username,
            round.name,
            openRaces.length,
            cutoffFormatted
          );
          email.to = member.email;
          await sendEmail(email);
          results.bettingOpen++;
        }

        await prisma.notification.create({
          data: {
            userId: members[0]?.id || "system",
            type: bettingOpenKey,
            title: `Betting open: ${round.name}`,
            body: `${openRaces.length} races`,
            isRead: true,
          },
        });
      }

      // --- 2 & 3. Per-venue reminders ---
      for (const venue of Array.from(venueCutoffs.keys())) {
        const cutoff = venueCutoffs.get(venue)!;
        const hoursUntilCutoff = (cutoff.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursUntilCutoff <= 0) continue;

        const venueRaces = openRaces.filter((r) => r.venue === venue);
        if (venueRaces.length === 0) continue;

        // 3-hour reminder
        if (hoursUntilCutoff <= 3 && hoursUntilCutoff > 1) {
          const reminderKey = `reminder-3h-${round.id}-${venue}`;
          const alreadySent = await prisma.notification.findFirst({
            where: { type: reminderKey },
          });

          if (!alreadySent) {
            for (const member of members) {
              const untipped = venueRaces.filter(
                (r) => !tippedSet.has(`${member.id}:${r.id}`)
              );
              if (untipped.length === 0) continue;

              const email = tipReminderEmail(
                member.username,
                `${round.name} (${venue})`,
                untipped.map((r) => r.name),
                3
              );
              email.to = member.email;
              await sendEmail(email);
              results.reminder3h++;
            }

            await prisma.notification.create({
              data: {
                userId: members[0]?.id || "system",
                type: reminderKey,
                title: `3h reminder: ${round.name} (${venue})`,
                body: "Sent to untipped members",
                isRead: true,
              },
            });
          }
        }

        // 1-hour reminder
        if (hoursUntilCutoff <= 1 && hoursUntilCutoff > 0) {
          const reminderKey = `reminder-1h-${round.id}-${venue}`;
          const alreadySent = await prisma.notification.findFirst({
            where: { type: reminderKey },
          });

          if (!alreadySent) {
            for (const member of members) {
              const untipped = venueRaces.filter(
                (r) => !tippedSet.has(`${member.id}:${r.id}`)
              );
              if (untipped.length === 0) continue;

              const email = tipReminderEmail(
                member.username,
                `${round.name} (${venue})`,
                untipped.map((r) => r.name),
                1
              );
              email.to = member.email;
              await sendEmail(email);
              results.reminder1h++;
            }

            await prisma.notification.create({
              data: {
                userId: members[0]?.id || "system",
                type: reminderKey,
                title: `1h reminder: ${round.name} (${venue})`,
                body: "Sent to untipped members",
                isRead: true,
              },
            });
          }
        }
      }
    }

    return NextResponse.json({
      message: "Notifications processed",
      ...results,
    });
  } catch (error) {
    console.error("Send notifications error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
