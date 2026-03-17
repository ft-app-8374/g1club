"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const [inviteCode, setInviteCode] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode, username, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      // Auto sign in after registration
      const signInRes = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (signInRes?.error) {
        router.push("/login");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Join the Club</h1>
          <p className="text-slate-400">
            Enter your invite code to get started
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-navy-card rounded-xl p-6 border border-navy-border"
        >
          {error && (
            <div className="bg-loss/10 border border-loss/30 text-loss rounded-lg px-4 py-2 mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm text-slate-400 mb-1">
              Invite Code
            </label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="w-full bg-navy-light border border-navy-border rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-gold transition"
              placeholder="Enter your invite code"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm text-slate-400 mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-navy-light border border-navy-border rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-gold transition"
              placeholder="e.g. Law, TheCat, Simmo"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm text-slate-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-navy-light border border-navy-border rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-gold transition"
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm text-slate-400 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-navy-light border border-navy-border rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-gold transition"
              placeholder="At least 6 characters"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gold hover:bg-gold-dark text-navy font-bold py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>

          <p className="text-center text-sm text-slate-400 mt-4">
            Already have an account?{" "}
            <Link href="/login" className="text-gold hover:text-gold-light">
              Log in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
