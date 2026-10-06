import { getSessionUser } from "@/lib/auth";
import {
  addUserWallpaper,
  getUserWallpapers,
  WallpaperLimitError,
} from "@/lib/user-settings-data";

const MAX_REQUEST_BYTES = 90 * 1024 * 1024;

class RequestTooLargeError extends Error {}

async function readBoundedJson(request: Request): Promise<unknown> {
  if (!request.body) throw new Error("Wallpaper request body is empty.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_REQUEST_BYTES) {
      try {
        await reader.cancel();
      } catch (error) {
        console.error("Oversized wallpaper request could not be cancelled:", error);
      }
      throw new RequestTooLargeError();
    }
    chunks.push(value);
  }
  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(body)) as unknown;
}

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return Response.json({ error: "Sign in to load your wallpapers." }, { status: 401 });
    }
    return Response.json(
      { wallpapers: getUserWallpapers(user.id) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("User wallpapers could not be loaded:", error);
    return Response.json(
      { error: "Unable to load your saved wallpapers right now." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return Response.json({ error: "Sign in to save a wallpaper." }, { status: 401 });
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_REQUEST_BYTES) {
      return Response.json({ error: "Wallpaper upload is too large." }, { status: 413 });
    }

    let body: unknown;
    try {
      body = await readBoundedJson(request);
    } catch (error) {
      if (error instanceof RequestTooLargeError) {
        return Response.json({ error: "Wallpaper upload is too large." }, { status: 413 });
      }
      return Response.json({ error: "Invalid wallpaper upload." }, { status: 400 });
    }
    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body) ||
      !("dataUrl" in body)
    ) {
      return Response.json({ error: "Invalid wallpaper upload." }, { status: 400 });
    }

    let wallpapers;
    try {
      wallpapers = addUserWallpaper(user.id, body.dataUrl);
    } catch (error) {
      if (error instanceof WallpaperLimitError) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
    if (!wallpapers) {
      return Response.json(
        { error: "Choose a PNG, JPEG, WebP, or GIF wallpaper up to 64 MiB." },
        { status: 400 },
      );
    }

    return Response.json(
      { wallpapers },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Wallpaper could not be saved:", error);
    return Response.json(
      { error: "Unable to save this wallpaper right now." },
      { status: 500 },
    );
  }
}
