import { randomUUID } from "node:crypto";
import { getLandingPageSettings } from "@/lib/landing-page-data";
import {
  isValidBrandingImageDataUrl,
  isValidWallpaperImageDataUrl,
  MAX_LOGOS_PER_USER,
  MAX_WALLPAPERS_PER_USER,
  parseBrandingConfig,
  parseThemeConfig,
  type UserLogo,
  type UserWallpaper,
} from "@/lib/theme-settings-shared";
import {
  defaultUserProfile,
  isBuiltInAvatarId,
  isUserProfile,
  type UserProfile,
} from "@/lib/user-profile-shared";
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

export function getUserBranding(userId: string) {
  getLandingPageSettings();
  const file = readUserSettingsFile();
  if (!file) throw new Error("The user settings file could not be initialized.");
  const branding = file.users[userId]?.branding;
  if (!branding) return null;
  const parsed = parseBrandingConfig(branding);
  if (!parsed) throw new Error(`Invalid branding settings for user ${userId}.`);
  return parsed;
}

export function saveUserBranding(userId: string, value: unknown) {
  const branding = parseBrandingConfig(value);
  if (!branding) return false;
  const landingPage = getLandingPageSettings();
  updateUserSettingsFile(
    (file) => ({
      ...file,
      users: {
        ...file.users,
        [userId]: {
          ...file.users[userId],
          branding,
        },
      },
    }),
    landingPage,
  );
  return true;
}

export class WallpaperLimitError extends Error {}

export function getUserWallpapers(userId: string): UserWallpaper[] {
  getLandingPageSettings();
  const file = readUserSettingsFile();
  if (!file) throw new Error("The user settings file could not be initialized.");
  return file.users[userId]?.wallpapers ?? [];
}

export function addUserWallpaper(
  userId: string,
  value: unknown,
): UserWallpaper[] | null {
  if (!isValidWallpaperImageDataUrl(value)) return null;
  if (getUserWallpapers(userId).length >= MAX_WALLPAPERS_PER_USER) {
    throw new WallpaperLimitError(
      "You've reached the wallpaper limit. Delete one before adding another.",
    );
  }
  const wallpaper: UserWallpaper = { id: randomUUID(), dataUrl: value };
  const landingPage = getLandingPageSettings();
  const updated = updateUserSettingsFile(
    (file) => ({
      ...file,
      users: {
        ...file.users,
        [userId]: {
          ...file.users[userId],
          wallpapers: [...(file.users[userId]?.wallpapers ?? []), wallpaper],
        },
      },
    }),
    landingPage,
  );
  return updated.users[userId]?.wallpapers ?? [];
}

export function removeUserWallpaper(userId: string, id: string): UserWallpaper[] {
  const landingPage = getLandingPageSettings();
  const updated = updateUserSettingsFile(
    (file) => ({
      ...file,
      users: {
        ...file.users,
        [userId]: {
          ...file.users[userId],
          wallpapers: (file.users[userId]?.wallpapers ?? []).filter(
            (wallpaper) => wallpaper.id !== id,
          ),
        },
      },
    }),
    landingPage,
  );
  return updated.users[userId]?.wallpapers ?? [];
}

export class LogoLimitError extends Error {}

export function getUserLogos(userId: string): UserLogo[] {
  getLandingPageSettings();
  const file = readUserSettingsFile();
  if (!file) throw new Error("The user settings file could not be initialized.");
  return file.users[userId]?.logos ?? [];
}

export function addUserLogo(
  userId: string,
  value: unknown,
): UserLogo[] | null {
  if (!isValidBrandingImageDataUrl(value)) return null;
  if (getUserLogos(userId).length >= MAX_LOGOS_PER_USER) {
    throw new LogoLimitError(
      "You've reached the logo limit. Delete one before adding another.",
    );
  }
  const logo: UserLogo = { id: randomUUID(), dataUrl: value };
  const landingPage = getLandingPageSettings();
  const updated = updateUserSettingsFile(
    (file) => ({
      ...file,
      users: {
        ...file.users,
        [userId]: {
          ...file.users[userId],
          logos: [...(file.users[userId]?.logos ?? []), logo],
        },
      },
    }),
    landingPage,
  );
  return updated.users[userId]?.logos ?? [];
}

export function removeUserLogo(userId: string, id: string): UserLogo[] {
  const landingPage = getLandingPageSettings();
  const updated = updateUserSettingsFile(
    (file) => ({
      ...file,
      users: {
        ...file.users,
        [userId]: {
          ...file.users[userId],
          logos: (file.users[userId]?.logos ?? []).filter(
            (logo) => logo.id !== id,
          ),
        },
      },
    }),
    landingPage,
  );
  return updated.users[userId]?.logos ?? [];
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

export function getUserProfile(userId: string, email: string): UserProfile {
  getLandingPageSettings();
  const file = readUserSettingsFile();
  if (!file) throw new Error("The user settings file could not be initialized.");
  const profile = file.users[userId]?.profile;
  if (!profile) return defaultUserProfile(email);
  if (
    !isUserProfile(profile) ||
    (!isBuiltInAvatarId(profile.avatar) && !isValidAvatarUpload(profile.avatar))
  ) {
    throw new Error(`Invalid profile settings for user ${userId}.`);
  }
  return profile;
}

function isValidAvatarUpload(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length > 2_800_000 ||
    isBuiltInAvatarId(value)
  ) {
    return false;
  }
  const match =
    /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      value,
    );
  if (!match) return false;

  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > 2 * 1024 * 1024) return false;
  if (bytes.toString("base64") !== match[2]) return false;

  switch (match[1]) {
    case "png":
      return bytes.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
    case "jpeg":
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "gif":
      return (
        bytes.subarray(0, 6).toString("ascii") === "GIF87a" ||
        bytes.subarray(0, 6).toString("ascii") === "GIF89a"
      );
    case "webp":
      return (
        bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
        bytes.subarray(8, 12).toString("ascii") === "WEBP"
      );
    default:
      return false;
  }
}

export function saveUserProfile(
  userId: string,
  value: unknown,
): UserProfile | null {
  if (
    !isUserProfile(value) ||
    (!isBuiltInAvatarId(value.avatar) && !isValidAvatarUpload(value.avatar))
  ) {
    return null;
  }

  const profile = {
    displayName: value.displayName,
    avatar: value.avatar,
  };
  const landingPage = getLandingPageSettings();
  updateUserSettingsFile(
    (file) => ({
      ...file,
      users: {
        ...file.users,
        [userId]: {
          ...file.users[userId],
          profile,
        },
      },
    }),
    landingPage,
  );
  return profile;
}
