import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { inviteCode, username, email, password } = await req.json();

    if (!inviteCode || !username || !email || !password) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    if (password.length < 6 || password.length > 72) {
      return NextResponse.json(
        { error: "Password must be between 6 and 72 characters" },
        { status: 400 }
      );
    }

    // Validate username: alphanumeric + underscore, 2-20 chars
    if (!/^[a-zA-Z0-9_]{2,20}$/.test(username)) {
      return NextResponse.json(
        { error: "Username must be 2-20 characters (letters, numbers, underscore)" },
        { status: 400 }
      );
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    // Atomic registration — validate invite, create user, mark invite used in one transaction
    const user = await prisma.$transaction(async (tx) => {
      const invite = await tx.inviteCode.findUnique({
        where: { code: inviteCode },
      });

      if (!invite || invite.usedBy || new Date() > invite.expiresAt) {
        throw new Error("INVALID_INVITE");
      }

      // Check uniqueness
      const existing = await tx.user.findFirst({
        where: { OR: [{ username }, { email }] },
      });

      if (existing) {
        throw new Error("USERNAME_OR_EMAIL_TAKEN");
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const newUser = await tx.user.create({
        data: {
          username,
          email,
          passwordHash,
          inviteCodeUsed: inviteCode,
        },
      });

      await tx.inviteCode.update({
        where: { code: inviteCode },
        data: { usedBy: newUser.id },
      });

      return newUser;
    }).catch((err) => {
      if (err.message === "INVALID_INVITE") {
        return { error: "Invalid or expired invite code" };
      }
      if (err.message === "USERNAME_OR_EMAIL_TAKEN") {
        return { error: "Username or email already registered" };
      }
      throw err;
    });

    if ("error" in user) {
      return NextResponse.json({ error: user.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, username: user.username });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
