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

// --- Admin: Fields Loaded + Tipping Open ---
export function fieldsLoadedEmail(
  adminName: string,
  roundName: string,
  races: Array<{ name: string; venue: string; raceNumber: number; runnerCount: number }>,
  cutoffTime: string,
  cutoffCountdown: string
): EmailOptions {
  const raceRows = races
    .map(
      (r) =>
        `<tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #1e293b; color: #e2e8f0;">${escapeHtml(r.name)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #1e293b; color: #94a3b8;">${escapeHtml(r.venue)} R${r.raceNumber}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #1e293b; color: #94a3b8; text-align: center;">${r.runnerCount}</td>
        </tr>`
    )
    .join("");

  return {
    to: "",
    subject: `✅ Fields Loaded — ${roundName}`,
    html: wrapTemplate(`
      <h2 style="color: #10b981; margin-top: 0;">Fields Loaded & Tipping Open</h2>
      <p style="color: #94a3b8; line-height: 1.6;">
        Hey ${escapeHtml(adminName)}, fields have been loaded for <strong style="color: #d4a843;">${escapeHtml(roundName)}</strong>.
        Tipping is now open and the countdown timer is active.
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <thead>
          <tr style="border-bottom: 2px solid #d4a843;">
            <th style="padding: 8px 12px; text-align: left; color: #d4a843;">Race</th>
            <th style="padding: 8px 12px; text-align: left; color: #d4a843;">Venue</th>
            <th style="padding: 8px 12px; text-align: center; color: #d4a843;">Runners</th>
          </tr>
        </thead>
        <tbody>${raceRows}</tbody>
      </table>
      <div style="background: #111827; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="color: #94a3b8; margin: 0 0 4px 0; font-size: 13px;">Tips close at</p>
        <p style="color: #e2e8f0; margin: 0; font-size: 18px; font-weight: bold;">${escapeHtml(cutoffTime)}</p>
        <p style="color: #d4a843; margin: 4px 0 0 0; font-size: 14px;">${escapeHtml(cutoffCountdown)}</p>
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${APP_URL}/admin" style="background-color: #d4a843; color: #0a0f1e; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
          Open Admin Panel
        </a>
      </div>
    `),
  };
}

// --- Member: Tip Confirmation ---
export function tipConfirmationEmail(
  username: string,
  roundName: string,
  tips: Array<{
    raceName: string;
    lines: Array<{ horse: string; betType: string; amount: number; backup?: string }>;
  }>
): EmailOptions {
  const raceBlocks = tips
    .map((race) => {
      const lineRows = race.lines
        .map(
          (l) =>
            `<tr>
              <td style="padding: 6px 12px; border-bottom: 1px solid #1e293b; color: #e2e8f0;">${escapeHtml(l.horse)}</td>
              <td style="padding: 6px 12px; border-bottom: 1px solid #1e293b; color: #94a3b8; text-transform: capitalize;">${escapeHtml(l.betType)}</td>
              <td style="padding: 6px 12px; border-bottom: 1px solid #1e293b; color: #10b981; text-align: right;">$${l.amount.toFixed(0)}</td>
              <td style="padding: 6px 12px; border-bottom: 1px solid #1e293b; color: #64748b; font-size: 12px;">${l.backup ? escapeHtml(l.backup) : "—"}</td>
            </tr>`
        )
        .join("");

      return `
        <h3 style="color: #d4a843; margin: 16px 0 8px 0; font-size: 15px;">${escapeHtml(race.raceName)}</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 1px solid #334155;">
              <th style="padding: 6px 12px; text-align: left; color: #64748b; font-size: 12px;">Horse</th>
              <th style="padding: 6px 12px; text-align: left; color: #64748b; font-size: 12px;">Type</th>
              <th style="padding: 6px 12px; text-align: right; color: #64748b; font-size: 12px;">Stake</th>
              <th style="padding: 6px 12px; text-align: left; color: #64748b; font-size: 12px;">Backup</th>
            </tr>
          </thead>
          <tbody>${lineRows}</tbody>
        </table>
      `;
    })
    .join("");

  return {
    to: "",
    subject: `Tips Confirmed — ${roundName}`,
    html: wrapTemplate(`
      <h2 style="color: #10b981; margin-top: 0;">Tips Confirmed</h2>
      <p style="color: #94a3b8; line-height: 1.6;">
        Hey ${escapeHtml(username)}, your tips for <strong style="color: #d4a843;">${escapeHtml(roundName)}</strong> are locked in.
        All ${tips.length} race${tips.length !== 1 ? "s" : ""} tipped — you're all set!
      </p>
      ${raceBlocks}
      <p style="color: #64748b; font-size: 13px; margin-top: 20px;">
        You can edit your tips anytime before the cutoff.
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${APP_URL}/races" style="background-color: #d4a843; color: #0a0f1e; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
          View My Tips
        </a>
      </div>
    `),
  };
}

// --- Admin: Post-Lockout Summary ---
export function lockoutSummaryEmail(
  adminName: string,
  roundName: string,
  totalMembers: number,
  tippedCount: number,
  untippedMembers: string[]
): EmailOptions {
  const untippedList = untippedMembers.length > 0
    ? untippedMembers.map((u) => `<li style="color: #ef4444; padding: 2px 0;">${escapeHtml(u)}</li>`).join("")
    : `<li style="color: #10b981;">Everyone has tipped!</li>`;

  return {
    to: "",
    subject: `Lockout Complete — ${roundName} (${tippedCount}/${totalMembers} tipped)`,
    html: wrapTemplate(`
      <h2 style="color: #e2e8f0; margin-top: 0;">Lockout Complete</h2>
      <p style="color: #94a3b8; line-height: 1.6;">
        Tips are now locked for <strong style="color: #d4a843;">${escapeHtml(roundName)}</strong>.
      </p>
      <div style="display: flex; gap: 16px; margin: 16px 0;">
        <div style="flex: 1; background: #111827; border-radius: 8px; padding: 16px; text-align: center;">
          <p style="color: #64748b; margin: 0; font-size: 13px;">Tipped</p>
          <p style="color: #10b981; font-size: 28px; font-weight: bold; margin: 4px 0 0 0;">${tippedCount}</p>
        </div>
        <div style="flex: 1; background: #111827; border-radius: 8px; padding: 16px; text-align: center;">
          <p style="color: #64748b; margin: 0; font-size: 13px;">Missing</p>
          <p style="color: ${untippedMembers.length > 0 ? "#ef4444" : "#10b981"}; font-size: 28px; font-weight: bold; margin: 4px 0 0 0;">${untippedMembers.length}</p>
        </div>
      </div>
      ${untippedMembers.length > 0 ? `
        <p style="color: #94a3b8; margin-bottom: 8px;">Members who didn't tip (will receive -$100 per race):</p>
        <ul style="list-style: none; padding: 0; margin: 0 0 16px 0;">${untippedList}</ul>
      ` : ""}
      <div style="text-align: center; margin: 24px 0;">
        <a href="${APP_URL}/admin" style="background-color: #d4a843; color: #0a0f1e; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
          View All Tips
        </a>
      </div>
    `),
  };
}

// --- Admin: Round Results Summary ---
export function roundResultsEmail(
  adminName: string,
  roundName: string,
  races: Array<{
    name: string;
    winner: string;
    winDividend: number | null;
    placeGetters: Array<{ name: string; placeDividend: number | null; position: number }>;
  }>,
  leaderboard: Array<{
    rank: number;
    username: string;
    roundProfit: number;
    seasonProfit: number;
  }>
): EmailOptions {
  const raceBlocks = races
    .map((race) => {
      const placeRows = race.placeGetters
        .map(
          (p) =>
            `<tr>
              <td style="padding: 4px 12px; color: #94a3b8;">${p.position}${p.position === 1 ? "st" : p.position === 2 ? "nd" : p.position === 3 ? "rd" : "th"}</td>
              <td style="padding: 4px 12px; color: #e2e8f0;">${escapeHtml(p.name)}</td>
              <td style="padding: 4px 12px; color: #94a3b8; text-align: right;">${p.placeDividend ? "$" + p.placeDividend.toFixed(2) : "—"}</td>
            </tr>`
        )
        .join("");

      return `
        <div style="background: #111827; border-radius: 8px; padding: 16px; margin: 12px 0;">
          <h3 style="color: #d4a843; margin: 0 0 4px 0;">${escapeHtml(race.name)}</h3>
          <p style="margin: 0 0 8px 0;">
            <span style="color: #10b981; font-weight: bold;">Winner: ${escapeHtml(race.winner)}</span>
            ${race.winDividend ? `<span style="color: #94a3b8;"> — $${race.winDividend.toFixed(2)}</span>` : ""}
          </p>
          <table style="width: 100%; border-collapse: collapse;">
            ${placeRows}
          </table>
        </div>
      `;
    })
    .join("");

  const leaderboardRows = leaderboard
    .map(
      (l) => {
        const profitColor = l.roundProfit >= 0 ? "#10b981" : "#ef4444";
        const seasonColor = l.seasonProfit >= 0 ? "#10b981" : "#ef4444";
        return `<tr>
          <td style="padding: 6px 12px; border-bottom: 1px solid #1e293b; color: #94a3b8;">#${l.rank}</td>
          <td style="padding: 6px 12px; border-bottom: 1px solid #1e293b; color: #e2e8f0;">${escapeHtml(l.username)}</td>
          <td style="padding: 6px 12px; border-bottom: 1px solid #1e293b; color: ${profitColor}; text-align: right;">${l.roundProfit >= 0 ? "+" : ""}$${l.roundProfit.toFixed(2)}</td>
          <td style="padding: 6px 12px; border-bottom: 1px solid #1e293b; color: ${seasonColor}; text-align: right;">${l.seasonProfit >= 0 ? "+" : ""}$${l.seasonProfit.toFixed(2)}</td>
        </tr>`;
      }
    )
    .join("");

  return {
    to: "",
    subject: `Round Results — ${roundName}`,
    html: wrapTemplate(`
      <h2 style="color: #d4a843; margin-top: 0;">Round Results — ${escapeHtml(roundName)}</h2>

      <h3 style="color: #e2e8f0; margin-top: 24px;">Race Results & Dividends</h3>
      ${raceBlocks}

      <h3 style="color: #e2e8f0; margin-top: 24px;">Leaderboard</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 8px 0;">
        <thead>
          <tr style="border-bottom: 2px solid #d4a843;">
            <th style="padding: 6px 12px; text-align: left; color: #d4a843;">Rank</th>
            <th style="padding: 6px 12px; text-align: left; color: #d4a843;">Tipper</th>
            <th style="padding: 6px 12px; text-align: right; color: #d4a843;">Round P&L</th>
            <th style="padding: 6px 12px; text-align: right; color: #d4a843;">Season P&L</th>
          </tr>
        </thead>
        <tbody>${leaderboardRows}</tbody>
      </table>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${APP_URL}/leaderboard" style="background-color: #d4a843; color: #0a0f1e; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
          View Full Leaderboard
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
