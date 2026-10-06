export type ThemeConfig = {
  presetId: string;
  primaryColor: string;
  bgColor: string;
  backgroundImage: string;
  mode?: "light" | "dark";
};


export const defaultThemeConfig: ThemeConfig = {
  presetId: "midnight",
  primaryColor: "#8b7cff",
  bgColor: "#090d19",
  backgroundImage:
    "radial-gradient(ellipse at 15% 10%, rgba(88, 74, 190, .48), transparent 42%), radial-gradient(ellipse at 85% 85%, rgba(21, 107, 143, .30), transparent 45%), linear-gradient(135deg, #090d19, #11172a 55%, #090d19)",
  mode: "light",
};

export const solarThemeConfig: ThemeConfig = {
  presetId: "solar",
  primaryColor: "#ff9900",
  bgColor: "#fffbe6",
  backgroundImage: "radial-gradient(circle at top left, #ffe4b5 0%, transparent 50%), linear-gradient(to bottom, #fffbe6, #f0f0f0)",
  mode: "light",
};

export const slateThemeConfig: ThemeConfig = {
  presetId: "slate",
  primaryColor: "#c0c0c0",
  bgColor: "#1e293b",
  backgroundImage: "radial-gradient(at center, #334155 0%, #1e293b 100%)",
  mode: "dark",
};

export const oceanicThemeConfig: ThemeConfig = {
  presetId: "oceanic",
  primaryColor: "#00bfff",
  bgColor: "#030712",
  backgroundImage:
    "radial-gradient(at center, #1d4ed8 0%, #030712 100%), linear-gradient(180deg, #030712, #0d152c)",
  mode: "dark",
};


export const MAX_THEME_IMAGE_BYTES = 64 * 1024 * 1024;
const MAX_BACKGROUND_VALUE_LENGTH = Math.ceil((MAX_THEME_IMAGE_BYTES * 4) / 3) + 128;

function isSafeBackgroundImage(value: string) {
  if (value.length > MAX_BACKGROUND_VALUE_LENGTH) return false;
  if (value === "none") return true;
  const wrappedDataUrl =
    /^url\(["']?(data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2})["']?\)$/.exec(
      value,
    );
  const rawDataUrl =
    /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(
      value,
    )
      ? value
      : null;
  const dataUrl = wrappedDataUrl?.[1] ?? rawDataUrl;
  if (dataUrl) {
    const encoded = dataUrl.slice(dataUrl.indexOf(",") + 1);
    const decodedLength = Math.floor((encoded.length * 3) / 4);
    return (
      encoded.length % 4 === 0 &&
      encoded.length <= Math.ceil((MAX_THEME_IMAGE_BYTES * 4) / 3) + 4 &&
      decodedLength <= MAX_THEME_IMAGE_BYTES
    );
  }
  const urlMatch = /^url\(["']?([^"'()<>;\s]+)["']?\)$/.exec(value);
  const url = urlMatch?.[1] ?? value;
  if (/^(?:https:\/\/[^\s"'()<>;]+|\/(?!\/)[^\s"'()<>;]*)$/.test(url)) {
    return true;
  }
  return (
    /^(?:radial|linear)-gradient\(/.test(value) &&
    /^[a-zA-Z0-9\s#.,%()/-]+$/.test(value)
  );
}

export function parseThemeConfig(value: unknown): ThemeConfig | null {
  const mode =
    typeof value === "object" && value !== null && "mode" in value
      ? value.mode
      : undefined;
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !("presetId" in value) ||
    typeof value.presetId !== "string" ||
    value.presetId.length > 64 ||
    !("primaryColor" in value) ||
    typeof value.primaryColor !== "string" ||
    !/^#[0-9a-f]{6}$/i.test(value.primaryColor) ||
    !("bgColor" in value) ||
    typeof value.bgColor !== "string" ||
    !/^#[0-9a-f]{6}$/i.test(value.bgColor) ||
    !("backgroundImage" in value) ||
    typeof value.backgroundImage !== "string" ||
    !isSafeBackgroundImage(value.backgroundImage) ||
    (mode !== undefined && mode !== "light" && mode !== "dark")
  ) {
    return null;
  }

  return {
    presetId: value.presetId,
    primaryColor: value.primaryColor,
    bgColor: value.bgColor,
    backgroundImage: value.backgroundImage,
    mode: mode === "dark" ? "dark" : "light",
  };
}

export type UserWallpaper = { id: string; dataUrl: string };

export const MAX_WALLPAPERS_PER_USER = 24;

const wallpaperIdPattern = /^[a-f0-9-]{8,64}$/i;

export function isWallpaperId(value: unknown): value is string {
  return typeof value === "string" && wallpaperIdPattern.test(value);
}

export function isValidWallpaperImageDataUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match =
    /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      value,
    );
  if (!match || match[2].length % 4 !== 0) return false;

  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > MAX_THEME_IMAGE_BYTES) return false;
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

export function isValidUserWallpaperList(value: unknown): value is UserWallpaper[] {
  if (!Array.isArray(value) || value.length > MAX_WALLPAPERS_PER_USER) return false;
  const ids = new Set<string>();
  for (const item of value) {
    if (
      typeof item !== "object" ||
      item === null ||
      Array.isArray(item) ||
      !("id" in item) ||
      !isWallpaperId(item.id) ||
      !("dataUrl" in item) ||
      !isValidWallpaperImageDataUrl(item.dataUrl)
    ) {
      return false;
    }
    ids.add(item.id);
  }
  return ids.size === value.length;
}

export type BrandingConfig = {
  mode: "text" | "image";
  text: string;
  imageDataUrl: string | null;
};

export const defaultBrandingConfig: BrandingConfig = {
  mode: "text",
  text: "Evil-Lander",
  imageDataUrl: null,
};

export const MAX_BRANDING_TEXT_LENGTH = 40;
export const MAX_BRANDING_IMAGE_BYTES = 4 * 1024 * 1024;

export function isValidBrandingText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= MAX_BRANDING_TEXT_LENGTH &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

export function isValidBrandingImageDataUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match =
    /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      value,
    );
  if (!match || match[2].length % 4 !== 0) return false;

  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > MAX_BRANDING_IMAGE_BYTES) return false;
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

export function parseBrandingConfig(value: unknown): BrandingConfig | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  if (
    !("mode" in value) ||
    (value.mode !== "text" && value.mode !== "image")
  ) {
    return null;
  }
  if (!("text" in value) || !isValidBrandingText(value.text)) return null;
  if (
    !("imageDataUrl" in value) ||
    (value.imageDataUrl !== null && !isValidBrandingImageDataUrl(value.imageDataUrl))
  ) {
    return null;
  }
  if (value.mode === "image" && !value.imageDataUrl) return null;

  return {
    mode: value.mode,
    text: value.text,
    imageDataUrl: value.imageDataUrl,
  };
}
