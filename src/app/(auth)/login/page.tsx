"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("Invalid username or password");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            Group 1 <span className="text-gold">Club</span>
          </h1>
          <p className="text-slate-500 italic">
            &ldquo;Tipping winners since&hellip; never&rdquo;
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
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-white border border-surface-muted rounded-lg px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition"
              placeholder="e.g. Law"
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
              className="w-full bg-white border border-surface-muted rounded-lg px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gold hover:bg-gold-dark text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>

          <div className="flex justify-between items-center mt-4 text-sm text-slate-500">
            <Link href="/forgot-password" className="text-slate-400 hover:text-gold transition">
              Forgot password?
            </Link>
            <span>
              Have an invite code?{" "}
              <Link href="/register" className="text-gold hover:text-gold-dark font-medium">
                Register
              </Link>
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
