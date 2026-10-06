import { getSessionUser } from "@/lib/auth";
import { deleteDashboard, getDashboard } from "@/lib/dashboard-data";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return Response.json({ error: "Sign in to manage dashboards." }, { status: 401 });
    }
    const { id } = await context.params;
    const result = deleteDashboard(user.id, id);
    if (result === "last-dashboard") {
      return Response.json(
        { error: "You must keep at least one dashboard." },
        { status: 400 },
      );
    }
    if (result === "not-found") {
      return Response.json({ error: "Dashboard not found." }, { status: 404 });
    }
    return Response.json({ data: getDashboard(user.id) });
  } catch (error) {
    console.error("Dashboard could not be closed:", error);
    return Response.json(
      { error: "Unable to close this dashboard right now." },
      { status: 500 },
    );
  }
}
