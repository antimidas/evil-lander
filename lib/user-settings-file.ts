import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { LandingPageSettings } from "@/lib/landing-page-shared";
import { parseThemeConfig, type ThemeConfig } from "@/lib/theme-settings-shared";
import { isProfileAvatar } from "@/lib/user-profile-shared";

export type UserSettingsFile = {
  version: 1;
  landingPage: LandingPageSettings;
  users: Record<
    string,
    {
      theme?: ThemeConfig;
      landingWidgetIds?: string[];
      landingWidgetPositions?: Record<string, { x: number; y: number }>;
      profile?: { displayName: string; avatar: string };
    }
  >;
};

const settingsPath = join(process.cwd(), ".data", "user-settings.json");

export function readUserSettingsFile(): UserSettingsFile | null {
  let contents: string;
  try {
    contents = readFileSync(settingsPath, "utf8");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new Error("The user settings file contains invalid JSON.", {
      cause: error,
    });
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed) ||
    !("version" in parsed) ||
    parsed.version !== 1 ||
    !("landingPage" in parsed) ||
    typeof parsed.landingPage !== "object" ||
    parsed.landingPage === null ||
    !("users" in parsed) ||
    typeof parsed.users !== "object" ||
    parsed.users === null ||
    Array.isArray(parsed.users)
  ) {
    throw new Error("The user settings file has an unsupported structure.");
  }

  for (const [userId, value] of Object.entries(parsed.users)) {
    if (
      !/^[a-zA-Z0-9-]{1,80}$/.test(userId) ||
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value)
    ) {
      throw new Error("The user settings file contains an invalid user entry.");
    }
    if (
      "theme" in value &&
      !parseThemeConfig(value.theme)
    ) {
      throw new Error(`The user settings file contains an invalid theme for ${userId}.`);
    }
    if (
      "profile" in value &&
      (typeof value.profile !== "object" ||
        value.profile === null ||
        Array.isArray(value.profile) ||
        typeof value.profile.displayName !== "string" ||
        value.profile.displayName.length < 1 ||
        value.profile.displayName.length > 40 ||
        value.profile.displayName.trim() !== value.profile.displayName ||
        /[\u0000-\u001f\u007f]/.test(value.profile.displayName) ||
        !isProfileAvatar(value.profile.avatar))
    ) {
      throw new Error(`The user settings file contains an invalid profile for ${userId}.`);
    }
    if (
      "landingWidgetIds" in value &&
      (!Array.isArray(value.landingWidgetIds) ||
        value.landingWidgetIds.length > 24 ||
        !value.landingWidgetIds.every(
        (id: unknown) =>
          typeof id === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(id),
      ) ||
        new Set(value.landingWidgetIds).size !== value.landingWidgetIds.length)
    ) {
      throw new Error(
        `The user settings file contains invalid landing widgets for ${userId}.`,
      );
    }
    if ("landingWidgetPositions" in value) {
      const positions = value.landingWidgetPositions;
      if (
        typeof positions !== "object" ||
        positions === null ||
        Array.isArray(positions) ||
        Object.keys(positions).length > 24 ||
        Object.entries(positions).some(
          ([widgetId, position]) =>
            !/^[a-zA-Z0-9-]{1,80}$/.test(widgetId) ||
            typeof position !== "object" ||
            position === null ||
            !("x" in position) ||
            typeof position.x !== "number" ||
            !Number.isFinite(position.x) ||
            position.x < 0 ||
            position.x > 100 ||
            !("y" in position) ||
            typeof position.y !== "number" ||
            !Number.isFinite(position.y) ||
            position.y < 0 ||
            position.y > 100,
        )
      ) {
        throw new Error(
          `The user settings file contains invalid landing widget positions for ${userId}.`,
        );
      }
    }
  }

  return parsed as UserSettingsFile;
}

export function writeUserSettingsFile(settings: UserSettingsFile) {
  mkdirSync(join(process.cwd(), ".data"), { recursive: true });
  const temporaryPath = `${settingsPath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  renameSync(temporaryPath, settingsPath);
}

export function updateUserSettingsFile(
  update: (settings: UserSettingsFile) => UserSettingsFile,
  initialLandingPage: LandingPageSettings,
) {
  const current = readUserSettingsFile() ?? {
    version: 1 as const,
    landingPage: initialLandingPage,
    users: {},
  };
  const updated = update(current);
  writeUserSettingsFile(updated);
  return updated;
}
