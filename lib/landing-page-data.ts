import { getDatabase } from "@/lib/auth";
import {
  defaultLandingPageSettings,
  type LandingPageImage,
  type LandingPageSettings,
} from "@/lib/landing-page-shared";
import {
  readUserSettingsFile,
  updateUserSettingsFile,
} from "@/lib/user-settings-file";

export { defaultLandingPageSettings } from "@/lib/landing-page-shared";
export type { LandingPageImage, LandingPageSettings } from "@/lib/landing-page-shared";

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 24 * 1024 * 1024;
const MAX_IMAGES = 8;
const allowedFonts = [
  "system-ui",
  "Arial",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Trebuchet MS",
  "Verdana",
  "Impact",
] as const;

function isPosition(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100
  );
}

function parseImageDataUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const match =
    /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      value,
    );
  if (!match || value.length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 64) {
    return null;
  }
  const bytes = Buffer.from(match[2], "base64");
  if (
    bytes.length === 0 ||
    bytes.length > MAX_IMAGE_BYTES ||
    bytes.toString("base64") !== match[2]
  ) {
    return null;
  }
  return { dataUrl: value, bytes: bytes.length };
}

function parseImages(value: unknown): {
  images: LandingPageImage[];
  bytes: number;
} | null {
  if (!Array.isArray(value) || value.length > MAX_IMAGES) return null;
  const ids = new Set<string>();
  const images: LandingPageImage[] = [];
  let bytes = 0;

  for (const item of value) {
    if (
      typeof item !== "object" ||
      item === null ||
      Array.isArray(item) ||
      !("id" in item) ||
      typeof item.id !== "string" ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(item.id) ||
      ids.has(item.id) ||
      !("dataUrl" in item) ||
      !("x" in item) ||
      !isPosition(item.x) ||
      !("y" in item) ||
      !isPosition(item.y) ||
      !("width" in item) ||
      typeof item.width !== "number" ||
      !Number.isFinite(item.width) ||
      item.width < 5 ||
      item.width > 100
    ) {
      return null;
    }
    const image = parseImageDataUrl(item.dataUrl);
    if (!image) return null;
    bytes += image.bytes;
    ids.add(item.id);
    images.push({
      id: item.id,
      dataUrl: image.dataUrl,
      x: item.x,
      y: item.y,
      width: item.width,
    });
  }

  return { images, bytes };
}

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
  const backgroundMode =
    settings.backgroundMode ?? defaultLandingPageSettings.backgroundMode;
  const backgroundColor =
    settings.backgroundColor ?? defaultLandingPageSettings.backgroundColor;
  const backgroundImageDataUrl = settings.backgroundImageDataUrl ?? null;
  const imagesValue = settings.images ?? [];
  const images = parseImages(imagesValue);
  const logoDataUrl =
    settings.logoDataUrl === null ? null : parseImageDataUrl(settings.logoDataUrl);
  const backgroundImage =
    backgroundImageDataUrl === null
      ? null
      : parseImageDataUrl(backgroundImageDataUrl);
  const welcomeFontFamily =
    settings.welcomeFontFamily ?? defaultLandingPageSettings.welcomeFontFamily;
  const welcomeFontSize =
    settings.welcomeFontSize ?? defaultLandingPageSettings.welcomeFontSize;
  const welcomeColor =
    settings.welcomeColor ?? defaultLandingPageSettings.welcomeColor;

  if (
    (backgroundMode !== "original" &&
      backgroundMode !== "color" &&
      backgroundMode !== "image") ||
    (settings.logoDataUrl !== null && !logoDataUrl) ||
    !isPosition(settings.logoX) ||
    !isPosition(settings.logoY) ||
    !images ||
    (backgroundMode === "image" && !backgroundImage) ||
    (backgroundImageDataUrl !== null && !backgroundImage) ||
    typeof backgroundColor !== "string" ||
    !/^#[0-9a-f]{6}$/i.test(backgroundColor) ||
    typeof settings.welcomeEnabled !== "boolean" ||
    typeof settings.welcomeText !== "string" ||
    settings.welcomeText.length > 500 ||
    !isPosition(settings.welcomeX) ||
    !isPosition(settings.welcomeY) ||
    typeof welcomeFontFamily !== "string" ||
    !allowedFonts.some((font) => font === welcomeFontFamily) ||
    typeof welcomeFontSize !== "number" ||
    !Number.isInteger(welcomeFontSize) ||
    welcomeFontSize < 14 ||
    welcomeFontSize > 96 ||
    typeof welcomeColor !== "string" ||
    !/^#[0-9a-f]{6}$/i.test(welcomeColor)
  ) {
    return null;
  }

  const imageBytes =
    (logoDataUrl?.bytes ?? 0) +
    (backgroundImage?.bytes ?? 0) +
    images.bytes;
  if (imageBytes > MAX_TOTAL_IMAGE_BYTES) return null;

  return {
    backgroundMode,
    backgroundColor,
    backgroundImageDataUrl: backgroundImage?.dataUrl ?? null,
    logoDataUrl: logoDataUrl?.dataUrl ?? null,
    logoX: settings.logoX,
    logoY: settings.logoY,
    images: images.images,
    welcomeEnabled: settings.welcomeEnabled,
    welcomeText: settings.welcomeText,
    welcomeX: settings.welcomeX,
    welcomeY: settings.welcomeY,
    welcomeFontFamily,
    welcomeFontSize,
    welcomeColor,
  };
}

export function getLandingPageSettings(): LandingPageSettings {
  const storedSettings = readUserSettingsFile();
  if (storedSettings) {
    const settings = parseLandingPageSettings(storedSettings.landingPage);
    if (!settings) throw new Error("Invalid landing page settings in user settings file.");
    return settings;
  }

  const row = getDatabase()
    .prepare(
      `SELECT background_mode, logo_data_url, logo_x, logo_y, welcome_enabled, welcome_text,
              welcome_x, welcome_y, background_color, background_image_data_url,
              images_json, welcome_font_family, welcome_font_size, welcome_color
       FROM landing_page_settings WHERE id = 1`,
    )
    .get();
  if (!row) {
    updateUserSettingsFile((file) => file, defaultLandingPageSettings);
    return defaultLandingPageSettings;
  }

  if (typeof row.images_json !== "string") {
    throw new Error("Invalid landing page images record.");
  }
  let images: unknown;
  try {
    images = JSON.parse(row.images_json);
  } catch (error) {
    throw new Error("Invalid landing page images record.", { cause: error });
  }

  const settings = parseLandingPageSettings({
    backgroundMode: row.background_mode,
    logoDataUrl: row.logo_data_url,
    logoX: row.logo_x,
    logoY: row.logo_y,
    welcomeEnabled: row.welcome_enabled === 1,
    welcomeText: row.welcome_text,
    welcomeX: row.welcome_x,
    welcomeY: row.welcome_y,
    backgroundColor: row.background_color,
    backgroundImageDataUrl: row.background_image_data_url,
    images,
    welcomeFontFamily: row.welcome_font_family,
    welcomeFontSize: row.welcome_font_size,
    welcomeColor: row.welcome_color,
  });
  if (!settings) throw new Error("Invalid landing page settings record.");
  updateUserSettingsFile((file) => ({ ...file, landingPage: settings }), settings);
  return settings;
}

export function saveLandingPageSettings(settings: LandingPageSettings) {
  const existing = getLandingPageSettings();
  updateUserSettingsFile(
    (file) => ({ ...file, landingPage: settings }),
    existing,
  );
}
