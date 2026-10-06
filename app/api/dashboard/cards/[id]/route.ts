import { getSessionUser } from "@/lib/auth";
import { deleteCard, updateCard } from "@/lib/dashboard-data";
import { readCardInput } from "@/lib/dashboard-validation";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return Response.json({ error: "Sign in to manage dashboard cards." }, { status: 401 });
    }

    const input = await readCardInput(request);
    if (!input) {
      return Response.json(
        { error: "Check the card title, section, content, and size." },
        { status: 400 },
      );
    }
    const { id } = await context.params;
    const card = updateCard(user.id, id, input);
    if (!card) {
      return Response.json({ error: "Dashboard card not found." }, { status: 404 });
    }
    return Response.json({ card });
  } catch (error) {
    console.error("Dashboard card could not be updated:", error);
    return Response.json(
      { error: "Unable to update this card right now." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return Response.json({ error: "Sign in to manage dashboard cards." }, { status: 401 });
    }
    const { id } = await context.params;
    if (!deleteCard(user.id, id)) {
      return Response.json({ error: "Dashboard card not found." }, { status: 404 });
    }
    return Response.json({ success: true });
  } catch (error) {
    console.error("Dashboard card could not be deleted:", error);
    return Response.json(
      { error: "Unable to delete this card right now." },
      { status: 500 },
    );
  }
}
