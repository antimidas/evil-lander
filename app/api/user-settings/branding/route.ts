import { getSessionUser } from "@/lib/auth";
import { getUserBranding, saveUserBranding } from "@/lib/user-settings-data";

const MAX_REQUEST_BYTES = 6 * 1024 * 1024;

class RequestTooLargeError extends Error {}

async function readBoundedJson(request: Request): Promise<unknown> {
  if (!request.body) throw new Error("Branding request body is empty.");
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
        console.error("Oversized branding request could not be cancelled:", error);
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
      return Response.json({ error: "Sign in to load your branding settings." }, { status: 401 });
    }
    return Response.json(
      { branding: getUserBranding(user.id) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("User branding settings could not be loaded:", error);
    return Response.json(
      { error: "Unable to load your branding settings right now." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return Response.json({ error: "Sign in to save your branding settings." }, { status: 401 });
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_REQUEST_BYTES) {
      return Response.json({ error: "Branding image upload is too large." }, { status: 413 });
    }

    let body: unknown;
    try {
      body = await readBoundedJson(request);
    } catch (error) {
      if (error instanceof RequestTooLargeError) {
        return Response.json({ error: "Branding image upload is too large." }, { status: 413 });
      }
      return Response.json({ error: "Invalid branding settings." }, { status: 400 });
    }
    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body) ||
      !("branding" in body) ||
      !saveUserBranding(user.id, body.branding)
    ) {
      return Response.json({ error: "Invalid branding settings." }, { status: 400 });
    }

    return Response.json({ branding: getUserBranding(user.id) });
  } catch (error) {
    console.error("User branding settings could not be saved:", error);
    return Response.json(
      { error: "Unable to save your branding settings right now." },
      { status: 500 },
    );
  }
}
