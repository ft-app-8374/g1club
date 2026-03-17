import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AppHeader } from "@/components/bottom-nav";

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
    <div className="min-h-screen bg-surface">
      <AppHeader
        isAdmin={session.user.role === "admin"}
        username={session.user.username}
      />

      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
