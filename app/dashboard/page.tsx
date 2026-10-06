import { redirect } from "next/navigation";
import DashboardClient from "./dashboard-client";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/");

  return <DashboardClient user={user} />;
}
