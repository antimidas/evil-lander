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

const MAX_THEME_IMAGE_BYTES = 64 * 1024 * 1024;
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
