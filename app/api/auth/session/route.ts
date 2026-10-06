import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    return Response.json({ user: await getSessionUser() });
  } catch (error) {
    console.error("Session lookup failed:", error);
    return Response.json(
      { error: "Unable to check your session right now." },
      { status: 500 },
    );
  }
}
