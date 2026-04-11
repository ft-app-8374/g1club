import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

// POST /api/cron/notify-failure
// Generic failure alert endpoint — sends email to all admins
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { subject, detail } = body;

    if (!subject || !detail) {
      return NextResponse.json(
        { error: "subject and detail required" },
        { status: 400 }
      );
    }

    const admins = await prisma.user.findMany({
      where: { role: "admin" },
      select: { email: true, username: true },
    });

    let sent = 0;
    for (const admin of admins) {
      const ok = await sendEmail({
        to: admin.email,
        subject: `⚠️ ACTION NEEDED — ${subject}`,
        html: `<div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0a0f1e; color: #e2e8f0; border-radius: 8px;">
          <div style="border-bottom: 2px solid #ef4444; padding-bottom: 16px; margin-bottom: 16px;">
            <h1 style="color: #ef4444; margin: 0; font-size: 20px;">Group 1 Club — System Alert</h1>
          </div>
          <h2 style="color: #e2e8f0; margin-top: 0;">${subject}</h2>
          <pre style="background: #111827; padding: 16px; border-radius: 8px; overflow-x: auto; color: #f97316; white-space: pre-wrap; font-size: 13px;">${detail}</pre>
          <p style="color: #64748b; font-size: 13px; margin-top: 16px;">
            Timestamp: ${new Date().toLocaleString("en-AU", { timeZone: "Australia/Sydney" })} AEST
          </p>
        </div>`,
      });
      if (ok) sent++;
    }

    return NextResponse.json({ message: "Failure alert sent", sent });
  } catch (error) {
    console.error("Notify failure error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
