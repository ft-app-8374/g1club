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

  const inputClasses =
    "w-full bg-white border border-surface-muted rounded-lg px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Join the <span className="text-gold">Club</span>
          </h1>
          <p className="text-slate-500">
            Enter your invite code to get started
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-card p-6 border border-surface-muted shadow-card"
        >
          {error && (
            <div className="bg-red-50 border border-red-200 text-loss rounded-lg px-4 py-2 mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm text-slate-600 mb-1 font-medium">
              Invite Code
            </label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className={inputClasses}
              placeholder="Enter your invite code"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm text-slate-600 mb-1 font-medium">
              Display Name
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClasses}
              placeholder="e.g. Law, TheCat, Simmo"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm text-slate-600 mb-1 font-medium">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClasses}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm text-slate-600 mb-1 font-medium">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClasses}
              placeholder="At least 6 characters"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gold hover:bg-gold-dark text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>

          <p className="text-center text-sm text-slate-500 mt-4">
            Already have an account?{" "}
            <Link href="/login" className="text-gold hover:text-gold-dark font-medium">
              Log in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
