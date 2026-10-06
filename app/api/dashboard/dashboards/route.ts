import { getSessionUser } from "@/lib/auth";
import { createDashboard, getDashboard } from "@/lib/dashboard-data";
import { readDashboardInput } from "@/lib/dashboard-validation";


export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return Response.json({ error: "Sign in to manage dashboards." }, { status: 401 });
    }
    const input = await readDashboardInput(request);
    if (!input) {
      return Response.json(
        { error: "Enter a dashboard name and a valid iframe URL when creating an iframe dashboard." },
        { status: 400 },
      );
    }
    const dashboard = createDashboard(user.id, input);
    return Response.json({ dashboard, data: getDashboard(user.id) }, { status: 201 });
  } catch (error) {
    console.error("Dashboard could not be created:", error);
    return Response.json(
      { error: "Unable to create this dashboard right now." },
      { status: 500 },
    );
  }
}
