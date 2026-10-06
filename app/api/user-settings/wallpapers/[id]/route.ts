import { getSessionUser } from "@/lib/auth";
import { removeUserWallpaper } from "@/lib/user-settings-data";
import { isWallpaperId } from "@/lib/theme-settings-shared";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return Response.json({ error: "Sign in to delete a wallpaper." }, { status: 401 });
    }

    const { id } = await params;
    if (!isWallpaperId(id)) {
      return Response.json({ error: "Invalid wallpaper id." }, { status: 400 });
    }

    const wallpapers = removeUserWallpaper(user.id, id);
    return Response.json(
      { wallpapers },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Wallpaper could not be deleted:", error);
    return Response.json(
      { error: "Unable to delete this wallpaper right now." },
      { status: 500 },
    );
  }
}
