import { getSessionUser } from "@/lib/auth";
import { removeUserLogo } from "@/lib/user-settings-data";
import { isWallpaperId } from "@/lib/theme-settings-shared";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return Response.json({ error: "Sign in to delete a logo." }, { status: 401 });
    }

    const { id } = await params;
    if (!isWallpaperId(id)) {
      return Response.json({ error: "Invalid logo id." }, { status: 400 });
    }

    const logos = removeUserLogo(user.id, id);
    return Response.json(
      { logos },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Logo could not be deleted:", error);
    return Response.json(
      { error: "Unable to delete this logo right now." },
      { status: 500 },
    );
  }
}
