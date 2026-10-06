import {
  createAccount,
  createSession,
  readCredentials,
  setSessionCookie,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const credentials = await readCredentials(request);
  if (!credentials || credentials.password.length < 12) {
    return Response.json(
      { error: "Enter a valid email and a password of at least 12 characters." },
      { status: 400 },
    );
  }

  try {
    const user = await createAccount(credentials.email, credentials.password);
    if (!user) {
      return Response.json(
        { error: "An account with that email already exists." },
        { status: 409 },
      );
    }

    const session = createSession(user);
    await setSessionCookie(session.token, session.expiresAt);
    return Response.json({ user }, { status: 201 });
  } catch (error) {
    console.error("Account signup failed:", error);
    return Response.json(
      { error: "Unable to create your account right now. Please try again." },
      { status: 500 },
    );
  }
}
