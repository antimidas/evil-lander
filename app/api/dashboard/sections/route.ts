import { getSessionUser } from "@/lib/auth";
import { createSection } from "@/lib/dashboard-data";
import { readSectionTitle } from "@/lib/dashboard-validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return Response.json({ error: "Sign in to manage dashboard sections." }, { status: 401 });
    }
    const title = await readSectionTitle(request);
    if (!title) {
      return Response.json({ error: "Enter a section name up to 60 characters." }, { status: 400 });
    }
    const section = createSection(user.id, title);
    return Response.json({ section }, { status: 201 });
  } catch (error) {
    console.error("Dashboard section could not be created:", error);
    return Response.json(
      { error: "Unable to create this section right now." },
      { status: 500 },
    );
  }
}
