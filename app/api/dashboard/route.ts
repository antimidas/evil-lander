import { getSessionUser } from "@/lib/auth";
import { getDashboard } from "@/lib/dashboard-data";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return Response.json({ error: "Sign in to access your dashboard." }, { status: 401 });
    }
    return Response.json(getDashboard(user.id));
  } catch (error) {
    console.error("Dashboard could not be loaded:", error);
    return Response.json(
      { error: "Unable to load your dashboard right now." },
      { status: 500 },
    );
  }
}
