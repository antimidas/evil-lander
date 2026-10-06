import { getSessionUser } from "@/lib/auth";
import { createCard, getDashboard } from "@/lib/dashboard-data";
import { readCardInput } from "@/lib/dashboard-validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return Response.json({ error: "Sign in to manage dashboard cards." }, { status: 401 });
    }

    const card = await readCardInput(request);
    if (!card) {
      return Response.json(
        { error: "Check the card title, section, content, and size." },
        { status: 400 },
      );
    }
    if (
      (card.type === "home-assistant" ||
        card.type === "home-assistant-light" ||
        card.type === "home-assistant-fan" ||
        card.type === "home-assistant-thermostat" ||
        card.type === "home-assistant-dashboard" ||
        (card.type === "weather" && card.config.provider === "home-assistant")) &&
      !getDashboard(user.id).homeAssistantConfigured
    ) {
      return Response.json(
        { error: "Ask your dashboard admin to configure Home Assistant first." },
        { status: 400 },
      );
    }

    const created = createCard(user.id, card);
    if (!created) {
      return Response.json({ error: "Choose a valid dashboard section." }, { status: 400 });
    }
    return Response.json({ card: created }, { status: 201 });
  } catch (error) {
    console.error("Dashboard card could not be created:", error);
    return Response.json(
      { error: "Unable to create this card right now." },
      { status: 500 },
    );
  }
}
