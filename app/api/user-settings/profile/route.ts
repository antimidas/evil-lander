import { getSessionUser } from "@/lib/auth";
import { getUserProfile, saveUserProfile } from "@/lib/user-settings-data";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 3 * 1024 * 1024;

class RequestTooLargeError extends Error {}

async function readBoundedJson(request: Request): Promise<unknown> {
  if (!request.body) throw new Error("Profile request body is empty.");
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
        console.error("Oversized profile request could not be cancelled:", error);
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
      return Response.json({ error: "Sign in to load your profile." }, { status: 401 });
    }
    return Response.json(
      { profile: getUserProfile(user.id, user.email) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("User profile could not be loaded:", error);
    return Response.json(
      { error: "Unable to load your profile right now." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return Response.json({ error: "Sign in to update your profile." }, { status: 401 });
    }

    if (Number(request.headers.get("content-length") ?? 0) > MAX_REQUEST_BYTES) {
      return Response.json({ error: "Profile image upload is too large." }, { status: 413 });
    }

    let body: unknown;
    try {
      body = await readBoundedJson(request);
    } catch (error) {
      if (error instanceof RequestTooLargeError) {
        return Response.json({ error: "Profile image upload is too large." }, { status: 413 });
      }
      return Response.json({ error: "Invalid profile settings." }, { status: 400 });
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body) ||
      !("profile" in body)
    ) {
      return Response.json({ error: "Invalid profile settings." }, { status: 400 });
    }
    const profile = saveUserProfile(user.id, body.profile);
    if (!profile) {
      return Response.json({ error: "Invalid profile settings or avatar image." }, { status: 400 });
    }
    return Response.json(
      { profile },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("User profile could not be saved:", error);
    return Response.json(
      { error: "Unable to save your profile right now." },
      { status: 500 },
    );
  }
}
