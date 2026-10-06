import { getSessionUser } from "@/lib/auth";
import { getDashboard } from "@/lib/dashboard-data";
import {
  getUserLandingWidgetIds,
  getUserLandingWidgetPositions,
  saveUserLandingWidgets,
} from "@/lib/user-settings-data";


function isWidgetIds(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= 24 &&
    value.every(
      (id): id is string =>
        typeof id === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(id),
    ) &&
    new Set(value).size === value.length
  );
}

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return Response.json({ error: "Sign in to load landing page widgets." }, { status: 401 });
    }
    const availableIds = new Set(getDashboard(user.id).cards.map((card) => card.id));
    return Response.json(
      {
        widgetIds: getUserLandingWidgetIds(user.id).filter((id) =>
          availableIds.has(id),
        ),
        positions: getUserLandingWidgetPositions(user.id),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Landing page widgets could not be loaded:", error);
    return Response.json(
      { error: "Unable to load your landing page widgets right now." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return Response.json({ error: "Sign in to update landing page widgets." }, { status: 401 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid landing page widget selection." }, { status: 400 });
    }
    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body) ||
      !("widgetIds" in body) ||
      !isWidgetIds(body.widgetIds)
    ) {
      return Response.json({ error: "Invalid landing page widget selection." }, { status: 400 });
    }
    const widgetIds = body.widgetIds;
    if (
      !("positions" in body) ||
      typeof body.positions !== "object" ||
      body.positions === null ||
      Array.isArray(body.positions) ||
      Object.keys(body.positions).length > 24 ||
      Object.entries(body.positions).some(
        ([id, position]) =>
          typeof position !== "object" ||
          position === null ||
          !("x" in position) ||
          typeof position.x !== "number" ||
          !Number.isFinite(position.x) ||
          position.x < 0 ||
          position.x > 100 ||
          !("y" in position) ||
          typeof position.y !== "number" ||
          !Number.isFinite(position.y) ||
          position.y < 0 ||
          position.y > 100 ||
          !widgetIds.includes(id),
      )
    ) {
      return Response.json({ error: "Invalid landing page widget positions." }, { status: 400 });
    }

    const availableIds = new Set(getDashboard(user.id).cards.map((card) => card.id));
    if (!widgetIds.every((id) => availableIds.has(id))) {
      return Response.json(
        { error: "Choose widgets from your own dashboards." },
        { status: 400 },
      );
    }
    saveUserLandingWidgets(
      user.id,
      widgetIds,
      body.positions as Record<string, { x: number; y: number }>,
    );
    return Response.json({
      widgetIds,
      positions: body.positions,
    });
  } catch (error) {
    console.error("Landing page widgets could not be saved:", error);
    return Response.json(
      { error: "Unable to save your landing page widgets right now." },
      { status: 500 },
    );
  }
}
