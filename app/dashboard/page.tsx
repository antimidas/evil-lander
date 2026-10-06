import { redirect } from "next/navigation";
import DashboardClient from "./dashboard-client";
import { getSessionUser } from "@/lib/auth";
import { getUserProfile } from "@/lib/user-settings-data";

export const runtime = "nodejs";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/");

  return <DashboardClient user={user} profile={getUserProfile(user.id, user.email)} />;
}
