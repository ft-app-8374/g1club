import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { sendEmail, resetPasswordEmail } from "@/lib/email";

// POST /api/auth/forgot-password
export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { message: "If that email is registered, a reset link has been sent." },
        { status: 200 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        message: "If that email is registered, a reset link has been sent.",
      });
    }

    // Generate token (URL-safe, 48 bytes = 64 chars base64)
    const resetToken = randomBytes(48).toString("base64url");
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry },
    });

    // Send email
    const emailData = resetPasswordEmail(user.username, resetToken);
    emailData.to = user.email;
    await sendEmail(emailData);

    return NextResponse.json({
      message: "If that email is registered, a reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { message: "If that email is registered, a reset link has been sent." },
      { status: 200 }
    );
  }
}
