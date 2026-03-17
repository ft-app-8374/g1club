import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { BottomNav } from "@/components/bottom-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-navy/95 backdrop-blur border-b border-navy-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gold">Group 1 Club</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">
              {session.user.username}
            </span>
            {session.user.role === "admin" && (
              <span className="text-xs bg-gold/20 text-gold px-2 py-0.5 rounded-full">
                Admin
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>

      <BottomNav isAdmin={session.user.role === "admin"} />
    </div>
  );
}
