import {
  createSession,
  readCredentials,
  setSessionCookie,
  verifyCredentials,
} from "@/lib/auth";


export async function POST(request: Request) {
  const credentials = await readCredentials(request);
  if (!credentials) {
    return Response.json(
      { error: "Enter a valid email and password." },
      { status: 400 },
    );
  }

  try {
    const user = await verifyCredentials(credentials.email, credentials.password);
    if (!user) {
      return Response.json(
        { error: "Invalid email or password." },
        { status: 401 },
      );
    }

    const session = createSession(user);
    await setSessionCookie(session.token, session.expiresAt);
    return Response.json({ user });
  } catch (error) {
    console.error("Account login failed:", error);
    return Response.json(
      { error: "Unable to sign in right now. Please try again." },
      { status: 500 },
    );
  }
}
