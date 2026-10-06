import { getSessionUser } from "@/lib/auth";
import { getUserProfile } from "@/lib/user-settings-data";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getSessionUser();
    return Response.json({
      user,
      profile: user ? getUserProfile(user.id, user.email) : null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Session lookup failed:", error);
    return Response.json(
      { error: "Unable to check your session right now." },
      { status: 500 },
    );
  }
}
