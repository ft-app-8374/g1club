import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVenueCutoffs } from "@/lib/cutoff";
import {
  sendEmail,
  bettingOpenEmail,
  tipReminderEmail,
  lockoutSummaryEmail,
  roundResultsEmail,
} from "@/lib/email";

// POST /api/cron/send-notifications
// Called every 5–30 minutes by cron
// Handles:
//   1. Betting open notification (when races move to "open" status)
//   2. 2-hour reminder for untipped members (per venue cutoff)
//   3. 1-hour final reminder for untipped members (per venue cutoff)
//   4. Post-lockout admin summary (non-tipper count)
//   5. Round results admin summary (after all races settled)
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const isLive = process.env.COMPETITION_LIVE === "true";
    const results = {
      bettingOpen: 0,
      reminder2h: 0,
      reminder1h: 0,
      lockoutSummary: 0,
      roundResults: 0,
      errors: [] as string[],
    };

    // Get active carnival with rounds
    const carnival = await prisma.carnival.findFirst({
      where: { status: { in: ["active", "upcoming"] } },
      include: {
        rounds: {
          include: {
            races: {
              where: { status: { not: "abandoned" } },
              include: {
                runners: { where: { isScratched: false } },
                results: { include: { runner: true } },
              },
            },
          },
          orderBy: { number: "asc" },
        },
      },
    });

    if (!carnival) {
      return NextResponse.json({ message: "No active carnival", ...results });
    }

    // Get admins
    const admins = await prisma.user.findMany({
      where: { role: "admin" },
      select: { id: true, username: true, email: true },
    });

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
      const closedRaces = round.races.filter((r) => r.status === "closed");
      const finalRaces = round.races.filter((r) => r.status === "final");
      const allRaces = round.races.filter((r) => r.status !== "abandoned");

      // Get per-venue cutoffs for this round
      const venueCutoffs = await getVenueCutoffs(round.id);

      // --- 1. Betting Open Notification ---
      if (openRaces.length > 0) {
        const bettingOpenKey = `betting-open-round-${round.id}`;
        const alreadyNotified = await prisma.notification.findFirst({
          where: { type: bettingOpenKey },
        });

        if (!alreadyNotified) {
          // Format all venue cutoffs for the email
          const cutoffLines: string[] = [];
          for (const venue of Array.from(venueCutoffs.keys())) {
            const cutoff = venueCutoffs.get(venue)!;
            if (!cutoff) continue;
            cutoffLines.push(
              `${venue}: ${cutoff.toLocaleString("en-AU", {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
                timeZone: "Australia/Sydney",
              })}`
            );
          }
          const cutoffFormatted = cutoffLines.join(" | ");

          // Send to all financial members only when live
          if (isLive) {
            for (const member of members) {
              const email = bettingOpenEmail(
                member.username,
                round.name,
                openRaces.length,
                cutoffFormatted
              );
              email.to = member.email;
              const sent = await sendEmail(email);
              if (sent) results.bettingOpen++;
            }
          }

          // Always send to admins (even during testing)
          for (const admin of admins) {
            const email = bettingOpenEmail(
              admin.username,
              round.name,
              openRaces.length,
              cutoffFormatted
            );
            email.to = admin.email;
            email.subject = isLive
              ? email.subject
              : `[TEST] ${email.subject}`;
            const sent = await sendEmail(email);
            if (sent) results.bettingOpen++;
          }

          await prisma.notification.create({
            data: {
              userId: admins[0]?.id || members[0]?.id || "system",
              type: bettingOpenKey,
              title: `Betting open: ${round.name}`,
              body: `${openRaces.length} races`,
              isRead: true,
            },
          });
        }
      }

      // --- 2 & 3. Per-venue reminders (2h and 1h) ---
      const reminderTargets = isLive ? members : admins;

      for (const venue of Array.from(venueCutoffs.keys())) {
        const cutoff = venueCutoffs.get(venue)!;
        if (!cutoff) continue;
        const hoursUntilCutoff =
          (cutoff.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursUntilCutoff <= 0) continue;

        const venueRaces = openRaces.filter((r) => r.venue === venue);
        if (venueRaces.length === 0) continue;

        // 2-hour reminder
        if (hoursUntilCutoff <= 2 && hoursUntilCutoff > 1) {
          const reminderKey = `reminder-2h-${round.id}-${venue}`;
          const alreadySent = await prisma.notification.findFirst({
            where: { type: reminderKey },
          });

          if (!alreadySent) {
            for (const member of reminderTargets) {
              const untipped = venueRaces.filter(
                (r) => !tippedSet.has(`${member.id}:${r.id}`)
              );
              if (untipped.length === 0) continue;

              const email = tipReminderEmail(
                member.username,
                `${round.name} (${venue})`,
                untipped.map((r) => r.name),
                2
              );
              email.to = member.email;
              if (!isLive) email.subject = `[TEST] ${email.subject}`;
              const sent = await sendEmail(email);
              if (sent) results.reminder2h++;
            }

            await prisma.notification.create({
              data: {
                userId: admins[0]?.id || "system",
                type: reminderKey,
                title: `2h reminder: ${round.name} (${venue})`,
                body: "Sent to untipped members",
                isRead: true,
              },
            });
          }
        }

        // 1-hour final reminder
        if (hoursUntilCutoff <= 1 && hoursUntilCutoff > 0) {
          const reminderKey = `reminder-1h-${round.id}-${venue}`;
          const alreadySent = await prisma.notification.findFirst({
            where: { type: reminderKey },
          });

          if (!alreadySent) {
            for (const member of reminderTargets) {
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
              if (!isLive) email.subject = `[TEST] ${email.subject}`;
              const sent = await sendEmail(email);
              if (sent) results.reminder1h++;
            }

            await prisma.notification.create({
              data: {
                userId: admins[0]?.id || "system",
                type: reminderKey,
                title: `1h reminder: ${round.name} (${venue})`,
                body: "Sent to untipped members",
                isRead: true,
              },
            });
          }
        }
      }

      // --- 4. Post-lockout admin summary ---
      // Trigger when ALL venues in the round have passed their cutoff
      // and we haven't sent this notification yet
      if (allRaces.length > 0) {
        const lockoutKey = `lockout-summary-${round.id}`;
        const allVenuesPastCutoff = Array.from(venueCutoffs.entries()).every(
          ([, cutoff]) => cutoff !== null && now >= cutoff
        );

        if (allVenuesPastCutoff && venueCutoffs.size > 0) {
          const alreadySent = await prisma.notification.findFirst({
            where: { type: lockoutKey },
          });

          if (!alreadySent) {
            // Count tipped vs untipped members
            const raceIds = allRaces.map((r) => r.id);
            const tippedUserIds = new Set<string>();
            const untippedUsers: string[] = [];

            for (const member of members) {
              const memberTippedAll = raceIds.every((raceId) =>
                tippedSet.has(`${member.id}:${raceId}`)
              );
              if (memberTippedAll) {
                tippedUserIds.add(member.id);
              } else {
                untippedUsers.push(member.username);
              }
            }

            for (const admin of admins) {
              const email = lockoutSummaryEmail(
                admin.username,
                round.name,
                members.length,
                tippedUserIds.size,
                untippedUsers
              );
              email.to = admin.email;
              const sent = await sendEmail(email);
              if (sent) results.lockoutSummary++;
            }

            await prisma.notification.create({
              data: {
                userId: admins[0]?.id || "system",
                type: lockoutKey,
                title: `Lockout: ${round.name}`,
                body: `${tippedUserIds.size}/${members.length} tipped`,
                isRead: true,
              },
            });
          }
        }
      }

      // --- 5. Round results admin summary ---
      // Trigger when ALL races in the round are settled (final)
      if (
        allRaces.length > 0 &&
        finalRaces.length === allRaces.length &&
        closedRaces.length === 0 &&
        openRaces.length === 0
      ) {
        const resultsKey = `round-results-${round.id}`;
        const alreadySent = await prisma.notification.findFirst({
          where: { type: resultsKey },
        });

        if (!alreadySent) {
          // Build race results with dividends
          const raceResults = finalRaces.map((race) => {
            const sortedResults = [...race.results].sort(
              (a, b) => a.finishPosition - b.finishPosition
            );

            const winner = sortedResults.find((r) => r.finishPosition === 1);
            const placeGetters = sortedResults
              .filter((r) => r.finishPosition <= race.numPlacePositions)
              .map((r) => ({
                name: r.runner.name,
                placeDividend: r.placeDividend ? Number(r.placeDividend) : null,
                position: r.finishPosition,
              }));

            return {
              name: race.name,
              winner: winner ? winner.runner.name : "Unknown",
              winDividend: winner?.winDividend
                ? Number(winner.winDividend)
                : null,
              placeGetters,
            };
          });

          // Build leaderboard — round P&L + season P&L
          const roundLedger = await prisma.ledger.findMany({
            where: { raceId: { in: allRaces.map((r) => r.id) } },
            select: { userId: true, profit: true },
          });

          // Sum round profits per user
          const roundProfitByUser = new Map<string, number>();
          for (const entry of roundLedger) {
            roundProfitByUser.set(
              entry.userId,
              (roundProfitByUser.get(entry.userId) || 0) +
                Number(entry.profit)
            );
          }

          // Get season totals
          const seasonLedger = await prisma.ledger.groupBy({
            by: ["userId"],
            _sum: { profit: true },
          });
          const seasonProfitByUser = new Map(
            seasonLedger.map((s) => [s.userId, Number(s._sum.profit || 0)])
          );

          // Get all users for username lookup
          const allUsers = await prisma.user.findMany({
            select: { id: true, username: true },
          });
          const usernameMap = new Map(
            allUsers.map((u) => [u.id, u.username])
          );

          // Build sorted leaderboard
          const leaderboard = Array.from(roundProfitByUser.entries())
            .map(([userId, roundProfit]) => ({
              username: usernameMap.get(userId) || "Unknown",
              roundProfit: Math.round(roundProfit * 100) / 100,
              seasonProfit: Math.round(
                (seasonProfitByUser.get(userId) || 0) * 100
              ) / 100,
            }))
            .sort((a, b) => b.roundProfit - a.roundProfit)
            .map((entry, i) => ({ rank: i + 1, ...entry }));

          for (const admin of admins) {
            const email = roundResultsEmail(
              admin.username,
              round.name,
              raceResults,
              leaderboard
            );
            email.to = admin.email;
            const sent = await sendEmail(email);
            if (sent) results.roundResults++;
          }

          await prisma.notification.create({
            data: {
              userId: admins[0]?.id || "system",
              type: resultsKey,
              title: `Results: ${round.name}`,
              body: `${finalRaces.length} races settled`,
              isRead: true,
            },
          });
        }
      }
    }

    return NextResponse.json({
      message: "Notifications processed",
      isLive,
      ...results,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Send notifications error:", msg);

    // Send failure alert to admins
    try {
      const admins = await prisma.user.findMany({
        where: { role: "admin" },
        select: { email: true, username: true },
      });
      for (const admin of admins) {
        await sendEmail({
          to: admin.email,
          subject: "⚠️ ACTION NEEDED — Notification System Error",
          html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #1a1a2e; color: #e2e8f0; border-radius: 8px;">
            <h2 style="color: #ef4444;">Notification System Error</h2>
            <p>The notification cron failed at ${new Date().toISOString()}:</p>
            <pre style="background: #0d1117; padding: 12px; border-radius: 4px; overflow-x: auto; color: #f97316;">${msg}</pre>
            <p style="color: #94a3b8;">Check App Runner logs for details.</p>
          </div>`,
        });
      }
    } catch {
      // Can't send failure email — just log
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
