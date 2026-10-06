import { getDatabase } from "@/lib/auth";
import {
  defaultLandingPageSettings,
  type LandingPageSettings,
} from "@/lib/landing-page-shared";

export { defaultLandingPageSettings } from "@/lib/landing-page-shared";
export type { LandingPageSettings } from "@/lib/landing-page-shared";

export function parseLandingPageSettings(
  value: unknown,
): LandingPageSettings | null {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !("logoDataUrl" in value) ||
    !("logoX" in value) ||
    !("logoY" in value) ||
    !("welcomeEnabled" in value) ||
    !("welcomeText" in value) ||
    !("welcomeX" in value) ||
    !("welcomeY" in value)
  ) {
    return null;
  }

  const settings = value as Record<string, unknown>;
  const { logoDataUrl, logoX, logoY, welcomeEnabled, welcomeText, welcomeX, welcomeY } =
    settings;
  if (
    (logoDataUrl !== null && typeof logoDataUrl !== "string") ||
    (typeof logoDataUrl === "string" &&
      !isAllowedLogoDataUrl(logoDataUrl)) ||
    typeof logoX !== "number" ||
    !Number.isFinite(logoX) ||
    logoX < 0 ||
    logoX > 100 ||
    typeof logoY !== "number" ||
    !Number.isFinite(logoY) ||
    logoY < 0 ||
    logoY > 100 ||
    typeof welcomeEnabled !== "boolean" ||
    typeof welcomeText !== "string" ||
    welcomeText.length > 500 ||
    typeof welcomeX !== "number" ||
    !Number.isFinite(welcomeX) ||
    welcomeX < 0 ||
    welcomeX > 100 ||
    typeof welcomeY !== "number" ||
    !Number.isFinite(welcomeY) ||
    welcomeY < 0 ||
    welcomeY > 100
  ) {
    return null;
  }

  return {
    logoDataUrl,
    logoX,
    logoY,
    welcomeEnabled,
    welcomeText,
    welcomeX,
    welcomeY,
  };
}

function isAllowedLogoDataUrl(value: string) {
  const match = /^data:image\/(?:png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    value,
  );
  if (!match || value.length > 1_400_000) return false;
  const bytes = Buffer.from(match[1], "base64");
  return bytes.length <= 1_000_000 && bytes.toString("base64") === match[1];
}

export function getLandingPageSettings(): LandingPageSettings {
  const row = getDatabase()
    .prepare(
      `SELECT logo_data_url, logo_x, logo_y, welcome_enabled, welcome_text,
              welcome_x, welcome_y
       FROM landing_page_settings WHERE id = 1`,
    )
    .get();
  if (!row) return defaultLandingPageSettings;

  const settings = parseLandingPageSettings({
    logoDataUrl: row.logo_data_url,
    logoX: row.logo_x,
    logoY: row.logo_y,
    welcomeEnabled: row.welcome_enabled === 1,
    welcomeText: row.welcome_text,
    welcomeX: row.welcome_x,
    welcomeY: row.welcome_y,
  });
  if (!settings) throw new Error("Invalid landing page settings record.");
  return settings;
}

export function saveLandingPageSettings(settings: LandingPageSettings) {
  getDatabase()
    .prepare(
      `INSERT INTO landing_page_settings
       (id, logo_data_url, logo_x, logo_y, welcome_enabled, welcome_text,
        welcome_x, welcome_y, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         logo_data_url = excluded.logo_data_url,
         logo_x = excluded.logo_x,
         logo_y = excluded.logo_y,
         welcome_enabled = excluded.welcome_enabled,
         welcome_text = excluded.welcome_text,
         welcome_x = excluded.welcome_x,
         welcome_y = excluded.welcome_y,
         updated_at = excluded.updated_at`,
    )
    .run(
      settings.logoDataUrl,
      settings.logoX,
      settings.logoY,
      settings.welcomeEnabled ? 1 : 0,
      settings.welcomeText,
      settings.welcomeX,
      settings.welcomeY,
      Date.now(),
    );
}
