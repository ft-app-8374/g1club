import nodemailer from "nodemailer";

// Email transporter — uses SES in production, Ethereal/SMTP in dev
function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn("SMTP not configured — emails will be logged only");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

const FROM_ADDRESS = process.env.EMAIL_FROM || "Group 1 Club <noreply@group1club.com>";

// Escape HTML entities to prevent XSS in email templates
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailOptions): Promise<boolean> {
  const transporter = getTransporter();

  if (!transporter) {
    console.log(`[EMAIL LOG] To: ${to} | Subject: ${subject}`);
    return false;
  }

  try {
    await transporter.sendMail({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error(`Email send failed to ${to}:`, error);
    return false;
  }
}

// --- Email Templates ---

const HEADER = `
<div style="background-color: #0a0f1e; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="padding: 20px; border-bottom: 2px solid #d4a843;">
    <h1 style="color: #d4a843; margin: 0; font-size: 24px;">Group 1 Club</h1>
  </div>
  <div style="padding: 24px;">
`;

const FOOTER = `
  </div>
  <div style="padding: 16px 24px; border-top: 1px solid #1e293b; font-size: 12px; color: #64748b;">
    <a href="${APP_URL}" style="color: #d4a843;">Open Group 1 Club</a>
  </div>
</div>
`;

function wrapTemplate(body: string): string {
  return HEADER + body + FOOTER;
}

export function bettingOpenEmail(username: string, roundName: string, raceCount: number, cutoffDate: string): EmailOptions {
  return {
    to: "", // caller fills this in
    subject: `Betting Open — ${roundName}`,
    html: wrapTemplate(`
      <h2 style="color: #e2e8f0; margin-top: 0;">Hey ${escapeHtml(username)},</h2>
      <p style="color: #94a3b8; line-height: 1.6;">
        <strong style="color: #d4a843;">${escapeHtml(roundName)}</strong> is now open for tipping!
      </p>
      <p style="color: #94a3b8; line-height: 1.6;">
        There ${raceCount === 1 ? "is" : "are"} <strong style="color: #e2e8f0;">${raceCount} race${raceCount !== 1 ? "s" : ""}</strong> this round.
        Get your $100 tips in before the cutoff.
      </p>
      <p style="color: #94a3b8; line-height: 1.6;">
        Tips close: <strong style="color: #e2e8f0;">${cutoffDate}</strong>
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${APP_URL}/races" style="background-color: #d4a843; color: #0a0f1e; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
          View Races & Tip Now
        </a>
      </div>
    `),
  };
}

export function tipReminderEmail(username: string, roundName: string, untippedRaces: string[], hoursLeft: number): EmailOptions {
  const raceList = untippedRaces.map((r) => `<li style="color: #e2e8f0; padding: 4px 0;">${escapeHtml(r)}</li>`).join("");
  const urgencyColor = hoursLeft <= 1 ? "#ef4444" : "#f97316";
  const urgencyText = hoursLeft <= 1 ? "FINAL REMINDER" : "Tip Reminder";

  return {
    to: "",
    subject: `${urgencyText} — ${hoursLeft}h left for ${roundName}`,
    html: wrapTemplate(`
      <h2 style="color: ${urgencyColor}; margin-top: 0;">${urgencyText}</h2>
      <p style="color: #94a3b8; line-height: 1.6;">
        Hey ${escapeHtml(username)}, you have <strong style="color: ${urgencyColor};">${hoursLeft} hour${hoursLeft !== 1 ? "s" : ""}</strong> left to submit your tips for <strong style="color: #d4a843;">${escapeHtml(roundName)}</strong>.
      </p>
      <p style="color: #94a3b8; line-height: 1.6;">
        Missing tip = automatic <strong style="color: #ef4444;">-$100</strong> penalty per race!
      </p>
      <p style="color: #94a3b8; margin-bottom: 8px;">Races still needing your tips:</p>
      <ul style="list-style: none; padding: 0; margin: 0 0 16px 0;">
        ${raceList}
      </ul>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${APP_URL}/races" style="background-color: ${urgencyColor}; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
          Submit Tips Now
        </a>
      </div>
    `),
  };
}

export function resultsEmail(username: string, raceName: string, profit: number, rank: number, totalPlayers: number): EmailOptions {
  const profitColor = profit >= 0 ? "#10b981" : "#ef4444";
  const profitStr = `${profit >= 0 ? "+" : ""}$${profit.toFixed(2)}`;

  return {
    to: "",
    subject: `Result: ${raceName} — ${profitStr}`,
    html: wrapTemplate(`
      <h2 style="color: #e2e8f0; margin-top: 0;">${escapeHtml(raceName)} — Result</h2>
      <div style="text-align: center; margin: 24px 0; padding: 20px; background: #111827; border-radius: 12px;">
        <p style="color: #64748b; margin: 0 0 8px 0; font-size: 14px;">Your P&L</p>
        <p style="color: ${profitColor}; font-size: 36px; font-weight: bold; margin: 0;">${profitStr}</p>
        <p style="color: #64748b; margin: 8px 0 0 0; font-size: 14px;">Rank: #${rank} of ${totalPlayers}</p>
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${APP_URL}/leaderboard" style="background-color: #d4a843; color: #0a0f1e; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
          View Leaderboard
        </a>
      </div>
    `),
  };
}

export function resetPasswordEmail(username: string, token: string): EmailOptions {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  return {
    to: "",
    subject: "Reset Your Password — Group 1 Club",
    html: wrapTemplate(`
      <h2 style="color: #e2e8f0; margin-top: 0;">Hey ${escapeHtml(username)},</h2>
      <p style="color: #94a3b8; line-height: 1.6;">
        We received a request to reset your password. Click the button below to choose a new one.
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${resetUrl}" style="background-color: #d4a843; color: #0a0f1e; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
          Reset Password
        </a>
      </div>
      <p style="color: #64748b; line-height: 1.6; font-size: 13px;">
        This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
      </p>
    `),
  };
}
