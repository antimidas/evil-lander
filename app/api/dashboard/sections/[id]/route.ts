import { getSessionUser } from "@/lib/auth";
import {
  deleteSection,
  updateSection,
} from "@/lib/dashboard-data";
import { readSectionTitle } from "@/lib/dashboard-validation";


type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return Response.json({ error: "Sign in to manage dashboard sections." }, { status: 401 });
    }
    const title = await readSectionTitle(request);
    if (!title) {
      return Response.json({ error: "Enter a section name up to 60 characters." }, { status: 400 });
    }
    const { id } = await context.params;
    const section = updateSection(user.id, id, title);
    if (!section) {
      return Response.json({ error: "Dashboard section not found." }, { status: 404 });
    }
    return Response.json({ section });
  } catch (error) {
    console.error("Dashboard section could not be updated:", error);
    return Response.json(
      { error: "Unable to update this section right now." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return Response.json({ error: "Sign in to manage dashboard sections." }, { status: 401 });
    }
    const { id } = await context.params;
    const result = deleteSection(user.id, id);
    if (result === "last-section") {
      return Response.json(
        { error: "A dashboard must keep at least one section." },
        { status: 400 },
      );
    }
    if (result === "not-found") {
      return Response.json({ error: "Dashboard section not found." }, { status: 404 });
    }
    return Response.json({ success: true });
  } catch (error) {
    console.error("Dashboard section could not be deleted:", error);
    return Response.json(
      { error: "Unable to delete this section right now." },
      { status: 500 },
    );
  }
}
