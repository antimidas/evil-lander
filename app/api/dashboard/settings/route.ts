import { getSessionUser } from "@/lib/auth";
import {
  getAdminUserId,
  getHomeAssistantSettings,
  saveHomeAssistantSettings,
  updateDashboardLayout,
} from "@/lib/dashboard-data";
import {
  readHomeAssistantSettings,
  readLayout,
} from "@/lib/dashboard-validation";


export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return Response.json({ error: "Sign in to access dashboard settings." }, { status: 401 });
    }
    const adminId = getAdminUserId();
    const connection = adminId ? getHomeAssistantSettings(adminId) : null;
    return Response.json({
      homeAssistantConfigured: connection?.configured ?? false,
      homeAssistantBaseUrl: connection?.baseUrl ?? "",
    });
  } catch (error) {
    console.error("Dashboard settings could not be loaded:", error);
    return Response.json(
      { error: "Unable to load dashboard settings right now." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return Response.json({ error: "Sign in to update dashboard settings." }, { status: 401 });
    }

    const body: unknown = await request.clone().json().catch(() => null);
    if (
      typeof body === "object" &&
      body !== null &&
      !Array.isArray(body) &&
      "layout" in body
    ) {
      const layout = await readLayout(request);
      if (!layout) {
        return Response.json({ error: "Choose a supported dashboard layout." }, { status: 400 });
      }
      updateDashboardLayout(user.id, layout);
      return Response.json({ success: true, layout });
    }

    if (user.role !== "admin") {
      return Response.json(
        { error: "Only the dashboard admin can configure Home Assistant." },
        { status: 403 },
      );
    }
    const settings = await readHomeAssistantSettings(request);
    if (!settings || !settings.baseUrl) {
      return Response.json(
        { error: "Enter a valid Home Assistant URL and access token." },
        { status: 400 },
      );
    }
    if (!settings.token) {
      const current = getHomeAssistantSettings(user.id);
      if (!current.configured) {
        return Response.json(
          { error: "Enter a Home Assistant long-lived access token." },
          { status: 400 },
        );
      }
    }

    try {
      saveHomeAssistantSettings(user.id, settings.baseUrl, settings.token || undefined);
    } catch (error) {
      if (error instanceof Error && error.message.includes("AUTH_ENCRYPTION_KEY")) {
        return Response.json(
          { error: "Set AUTH_ENCRYPTION_KEY on the server before saving Home Assistant credentials." },
          { status: 400 },
        );
      }
      throw error;
    }

    return Response.json({
      success: true,
      homeAssistantConfigured: true,
      homeAssistantBaseUrl: settings.baseUrl,
    });
  } catch (error) {
    console.error("Dashboard settings could not be updated:", error);
    return Response.json(
      { error: "Unable to update dashboard settings right now." },
      { status: 500 },
    );
  }
}
