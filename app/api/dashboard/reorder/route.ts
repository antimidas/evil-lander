import { getSessionUser } from "@/lib/auth";
import { reorderCards, reorderSections } from "@/lib/dashboard-data";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function PATCH(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return Response.json({ error: "Sign in to reorder dashboard items." }, { status: 401 });
    }
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return Response.json({ error: "Invalid reorder request." }, { status: 400 });
    }
    if (!isRecord(payload)) {
      return Response.json({ error: "Invalid reorder request." }, { status: 400 });
    }

    let updated = false;
    if (
      payload.type === "sections" &&
      Array.isArray(payload.ids) &&
      payload.ids.every((id) => typeof id === "string")
    ) {
      updated = reorderSections(user.id, payload.ids);
    } else if (
      payload.type === "cards" &&
      typeof payload.sectionId === "string" &&
      Array.isArray(payload.ids) &&
      payload.ids.every((id) => typeof id === "string")
    ) {
      updated = reorderCards(user.id, payload.sectionId, payload.ids);
    } else {
      return Response.json({ error: "Invalid reorder request." }, { status: 400 });
    }

    if (!updated) {
      return Response.json(
        { error: "The dashboard order is out of date. Refresh and try again." },
        { status: 409 },
      );
    }
    return Response.json({ success: true });
  } catch (error) {
    console.error("Dashboard items could not be reordered:", error);
    return Response.json(
      { error: "Unable to reorder dashboard items right now." },
      { status: 500 },
    );
  }
}
