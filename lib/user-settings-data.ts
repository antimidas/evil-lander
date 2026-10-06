import { getLandingPageSettings } from "@/lib/landing-page-data";
import { parseThemeConfig } from "@/lib/theme-settings-shared";
import { readUserSettingsFile, updateUserSettingsFile } from "@/lib/user-settings-file";

export function getUserThemeSettings(userId: string) {
  getLandingPageSettings();
  const file = readUserSettingsFile();
  if (!file) throw new Error("The user settings file could not be initialized.");
  const theme = file.users[userId]?.theme;
  if (!theme) return null;
  const parsed = parseThemeConfig(theme);
  if (!parsed) throw new Error(`Invalid theme settings for user ${userId}.`);
  return parsed;
}

export function saveUserThemeSettings(userId: string, value: unknown) {
  const theme = parseThemeConfig(value);
  if (!theme) return false;
  const landingPage = getLandingPageSettings();
  updateUserSettingsFile(
    (file) => ({
      ...file,
      users: {
        ...file.users,
        [userId]: {
          ...file.users[userId],
          theme,
        },
      },
    }),
    landingPage,
  );
  return true;
}

export function getUserLandingWidgetIds(userId: string) {
  getLandingPageSettings();
  const file = readUserSettingsFile();
  if (!file) throw new Error("The user settings file could not be initialized.");
  return file.users[userId]?.landingWidgetIds ?? [];
}

export type LandingWidgetPosition = { x: number; y: number };

export function getUserLandingWidgetPositions(
  userId: string,
): Record<string, LandingWidgetPosition> {
  getLandingPageSettings();
  const file = readUserSettingsFile();
  if (!file) throw new Error("The user settings file could not be initialized.");
  return file.users[userId]?.landingWidgetPositions ?? {};
}

export function saveUserLandingWidgets(
  userId: string,
  ids: string[],
  positions: Record<string, LandingWidgetPosition>,
) {
  const landingPage = getLandingPageSettings();
  updateUserSettingsFile(
    (file) => ({
      ...file,
      users: {
        ...file.users,
        [userId]: {
          ...file.users[userId],
          landingWidgetIds: ids,
          landingWidgetPositions: positions,
        },
      },
    }),
    landingPage,
  );
}
