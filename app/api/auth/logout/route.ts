import { deleteSession } from "@/lib/auth";


export async function POST() {
  try {
    await deleteSession();
    return Response.json({ success: true });
  } catch (error) {
    console.error("Account logout failed:", error);
    return Response.json(
      { error: "Unable to sign out right now. Please try again." },
      { status: 500 },
    );
  }
}
