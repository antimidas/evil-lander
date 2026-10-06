import { Suspense } from "react";
import { redirect } from "next/navigation";
import DashboardClient from "./dashboard-client";
import { getSessionUser } from "@/lib/auth";
import { getUserProfile } from "@/lib/user-settings-data";

async function DashboardContent() {
  const user = await getSessionUser();
  if (!user) redirect("/");

  return <DashboardClient user={user} profile={getUserProfile(user.id, user.email)} />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh p-8 text-zinc-600">Loading dashboard…</main>}>
      <DashboardContent />
    </Suspense>
  );
}
