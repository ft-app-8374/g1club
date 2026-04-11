import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!valid) return null;

        return {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          isFinancial: user.isFinancial,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as { username: string }).username;
        token.role = (user as { role: string }).role;
        token.isFinancial = (user as { isFinancial: boolean }).isFinancial;
      }
      return token;
    },
    async session({ session, token }) {
      // Refresh user fields from DB on every session check (in case admin changed them)
      let email = token.email as string;
      let isFinancial = (token.isFinancial as boolean) ?? false;
      let role = token.role as string;
      try {
        const { prisma } = await import("@/lib/prisma");
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { email: true, isFinancial: true, role: true },
        });
        if (dbUser) {
          email = dbUser.email;
          isFinancial = dbUser.isFinancial;
          role = dbUser.role;
        }
      } catch {
        // Fall back to token values if DB unavailable
      }
      session.user = {
        id: token.id as string,
        username: token.username as string,
        email,
        role,
        isFinancial,
      };
      return session;
    },
  },
};
