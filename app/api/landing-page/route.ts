import { getSessionUser } from "@/lib/auth";
import {
  getLandingPageSettings,
  parseLandingPageSettings,
  saveLandingPageSettings,
} from "@/lib/landing-page-data";

export const runtime = "nodejs";

export async function GET() {
  try {
    return Response.json(getLandingPageSettings(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Landing page settings could not be loaded:", error);
    return Response.json(
      { error: "Unable to load the landing page right now." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return Response.json(
        { error: "Sign in to customize the landing page." },
        { status: 401 },
      );
    }
    if (user.role !== "admin") {
      return Response.json(
        { error: "Only the admin can customize the landing page." },
        { status: 403 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid landing page settings." }, { status: 400 });
    }
    const settings = parseLandingPageSettings(body);
    if (!settings) {
      return Response.json(
        {
          error:
            "Check the landing page settings: images must be supported formats, no more than 12 MB each, and no more than 24 MB total.",
        },
        { status: 400 },
      );
    }

    saveLandingPageSettings(settings);
    return Response.json(settings);
  } catch (error) {
    console.error("Landing page settings could not be updated:", error);
    return Response.json(
      { error: "Unable to save landing page settings right now." },
      { status: 500 },
    );
  }
}
