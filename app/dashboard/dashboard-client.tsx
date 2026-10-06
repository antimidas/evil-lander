"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type PointerEvent } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRouter } from "next/navigation";
import type { AuthUser } from "@/lib/auth";
import type {
  DashboardCard,
  DashboardCardInput,
  DashboardCardType,
  DashboardPage,
  DashboardLayout,
  DashboardSection,
} from "@/lib/dashboard-data";
import { loadThemeWallpaper } from "@/lib/theme-wallpaper";
import {
  defaultThemeConfig,
  parseThemeConfig,
  type ThemeConfig,
} from "@/lib/theme-settings-shared";

const subscribeToClock = (callback: () => void) => {
  const interval = window.setInterval(callback, 1000);
  return () => window.clearInterval(interval);
};

const getClockSnapshot = () => Math.floor(Date.now() / 1000);
const getClockServerSnapshot = () => 0;

type DashboardData = {
  dashboards: DashboardPage[];
  layout: DashboardLayout;
  sections: DashboardSection[];
  cards: DashboardCard[];
  homeAssistantConfigured: boolean;
  homeAssistantBaseUrl: string;
};

const themePresets: Array<ThemeConfig & { name: string; description: string }> = [
  {
    presetId: "midnight",
    name: "Midnight",
    description: "Deep indigo with aurora",
    primaryColor: "#8b7cff",
    bgColor: "#090d19",
    backgroundImage:
      "radial-gradient(ellipse at 15% 10%, rgba(88, 74, 190, .48), transparent 42%), radial-gradient(ellipse at 85% 85%, rgba(21, 107, 143, .30), transparent 45%), linear-gradient(135deg, #090d19, #11172a 55%, #090d19)",
  },
  {
    presetId: "ocean",
    name: "Ocean",
    description: "Cool blue and teal",
    primaryColor: "#38bdf8",
    bgColor: "#071521",
    backgroundImage:
      "radial-gradient(ellipse at 85% 15%, rgba(14, 165, 233, .34), transparent 43%), radial-gradient(ellipse at 15% 90%, rgba(13, 148, 136, .34), transparent 42%), linear-gradient(140deg, #071521, #0a2637 55%, #071521)",
  },
  {
    presetId: "forest",
    name: "Forest",
    description: "Emerald and pine",
    primaryColor: "#4ade80",
    bgColor: "#091711",
    backgroundImage:
      "radial-gradient(ellipse at 18% 15%, rgba(22, 163, 74, .36), transparent 44%), radial-gradient(ellipse at 85% 85%, rgba(101, 163, 13, .24), transparent 42%), linear-gradient(145deg, #091711, #10271d 55%, #091711)",
  },
  {
    presetId: "sunset",
    name: "Sunset",
    description: "Warm coral and amber",
    primaryColor: "#fb7185",
    bgColor: "#1c1118",
    backgroundImage:
      "radial-gradient(ellipse at 12% 90%, rgba(249, 115, 22, .36), transparent 45%), radial-gradient(ellipse at 90% 8%, rgba(236, 72, 153, .30), transparent 43%), linear-gradient(145deg, #1c1118, #33202a 55%, #171019)",
  },
  {
    presetId: "rose",
    name: "Rose",
    description: "Soft pink and plum",
    primaryColor: "#f472b6",
    bgColor: "#1b101b",
    backgroundImage:
      "radial-gradient(ellipse at 20% 10%, rgba(219, 39, 119, .34), transparent 43%), radial-gradient(ellipse at 82% 85%, rgba(147, 51, 234, .28), transparent 45%), linear-gradient(135deg, #1b101b, #2a1830 58%, #140e1b)",
  },
  {
    presetId: "dracula",
    name: "Dracula",
    description: "Purple with vivid accents",
    primaryColor: "#bd93f9",
    bgColor: "#17151f",
    backgroundImage:
      "radial-gradient(ellipse at 10% 10%, rgba(189, 147, 249, .25), transparent 44%), radial-gradient(ellipse at 90% 90%, rgba(80, 250, 123, .16), transparent 42%), linear-gradient(140deg, #17151f, #282338 60%, #17151f)",
  },
  {
    presetId: "nord",
    name: "Nord",
    description: "Arctic blue-gray",
    primaryColor: "#88c0d0",
    bgColor: "#202a35",
    backgroundImage:
      "radial-gradient(ellipse at 12% 8%, rgba(136, 192, 208, .24), transparent 45%), radial-gradient(ellipse at 88% 92%, rgba(129, 161, 193, .22), transparent 46%), linear-gradient(140deg, #202a35, #303c4a 58%, #1b252f)",
  },
  {
    presetId: "cyberpunk",
    name: "Cyberpunk",
    description: "Electric cyan and magenta",
    primaryColor: "#e879f9",
    bgColor: "#100b1d",
    backgroundImage:
      "radial-gradient(ellipse at 15% 15%, rgba(217, 70, 239, .32), transparent 40%), radial-gradient(ellipse at 88% 82%, rgba(6, 182, 212, .30), transparent 42%), linear-gradient(130deg, #100b1d, #1c1030 55%, #0b1525)",
  },
  {
    presetId: "slate",
    name: "Slate",
    description: "Clean charcoal and silver",
    primaryColor: "#cbd5e1",
    bgColor: "#161b22",
    backgroundImage:
      "radial-gradient(ellipse at 18% 12%, rgba(100, 116, 139, .30), transparent 44%), radial-gradient(ellipse at 85% 90%, rgba(71, 85, 105, .26), transparent 45%), linear-gradient(140deg, #161b22, #252d38 60%, #12171e)",
  },
  {
    presetId: "amoled",
    name: "AMOLED",
    description: "Pure black with violet",
    primaryColor: "#a78bfa",
    bgColor: "#000000",
    backgroundImage:
      "radial-gradient(ellipse at 15% 10%, rgba(124, 58, 237, .30), transparent 42%), radial-gradient(ellipse at 90% 90%, rgba(8, 145, 178, .18), transparent 44%), #000000",
  },
  {
    presetId: "light",
    name: "Cloud",
    description: "Bright sky and soft clouds",
    primaryColor: "#2563eb",
    bgColor: "#eaf1fb",
    backgroundImage:
      "radial-gradient(ellipse at 12% 10%, rgba(255, 255, 255, .95), transparent 40%), radial-gradient(ellipse at 88% 90%, rgba(125, 211, 252, .52), transparent 48%), linear-gradient(140deg, #dbeafe, #f1f5f9 55%, #e0f2fe)",
  },
];

function wallpaperUrlFromBackground(backgroundImage: string) {
  const match = backgroundImage.match(/^url\((?:"([^"]*)"|'([^']*)'|([^)]*))\)$/);
  const url = match?.[1] ?? match?.[2] ?? match?.[3] ?? "";
  return url.startsWith("data:image/") || url.startsWith("lander-wallpaper:")
    ? ""
    : url;
}

function wallpaperIdFromBackground(backgroundImage: string) {
  const match = /^url\(["']?lander-wallpaper:([a-z0-9-]+)["']?\)$/i.exec(
    backgroundImage,
  );
  return match?.[1] ?? null;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("The saved wallpaper could not be read."));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error("The saved wallpaper could not be read."));
    reader.readAsDataURL(blob);
  });
}

async function persistThemeSettings(config: ThemeConfig) {
  const response = await fetch("/api/user-settings/theme", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ theme: config }),
  });
  const result: unknown = await response.json();
  if (
    !response.ok ||
    typeof result !== "object" ||
    result === null ||
    !("theme" in result)
  ) {
    throw new Error(
      typeof result === "object" &&
        result !== null &&
        "error" in result &&
        typeof result.error === "string"
        ? result.error
        : "Unable to save this theme.",
    );
  }
  const saved = parseThemeConfig(result.theme);
  if (!saved) throw new Error("The server returned invalid saved theme settings.");
  return saved;
}

function wallpaperBackgroundFromInput(value: string) {
  const url = value.trim();
  if (!url) return "none";
  if (
    url.startsWith("/") &&
    !url.startsWith("//") &&
    !/[\\\u0000-\u001f"']/.test(url)
  ) {
    return `url("${url}")`;
  }
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password
    ) {
      return `url("${parsed.toString()}")`;
    }
  } catch {
    return null;
  }
  return null;
}

type CardDraft = DashboardCardInput & { id?: string };

const desktopWidgetTypes: DashboardCardType[] = [
  "markdown",
  "image",
  "weather",
  "home-assistant",
  "home-assistant-light",
  "home-assistant-fan",
  "home-assistant-thermostat",
  "clock",
  "calendar",
];

function defaultDesktopDisplay(type: DashboardCardType) {
  return desktopWidgetTypes.includes(type) &&
    type !== "home-assistant-light" &&
    type !== "home-assistant-fan"
    ? "widget"
    : "button";
}

function isPersistentDashboardWidget(card: DashboardCard) {
  return (card.config.displayMode ?? defaultDesktopDisplay(card.type)) === "widget";
}

const cardTypeLabels: Record<DashboardCardType, string> = {
  markdown: "Text / Markdown",
  link: "Link",
  button: "Button",
  image: "Image",
  embed: "Website embed",
  weather: "Weather",
  "home-assistant": "Home Assistant entity",
  "home-assistant-light": "Home Assistant light",
  "home-assistant-fan": "Home Assistant fan",
  "home-assistant-thermostat": "Home Assistant thermostat",
  "home-assistant-dashboard": "Home Assistant dashboard",
  clock: "Clock",
  calendar: "Calendar",
};

const cardTypeDescriptions: Record<DashboardCardType, string> = {
  markdown: "Add formatted text, notes, and lists.",
  link: "Show a service link with an optional description.",
  button: "Add a prominent button to open a URL.",
  image: "Display an image from a URL.",
  embed: "Embed a website in a card.",
  weather: "Show current conditions and a forecast from Home Assistant.",
  "home-assistant": "Show a live Home Assistant entity state.",
  "home-assistant-light": "Open a light icon to control its power, brightness, color, and white temperature.",
  "home-assistant-fan": "Open a fan icon to control its power, speed, and direction when supported.",
  "home-assistant-thermostat": "Adjust a Home Assistant thermostat's target temperature and HVAC mode.",
  "home-assistant-dashboard": "Embed a Home Assistant view with its native cards.",
  clock: "Show a live clock in your local timezone.",
  calendar: "Show a navigable monthly calendar.",
};

function AddContentMenu({
  homeAssistantConfigured,
  onClose,
  onSelect,
}: {
  homeAssistantConfigured: boolean;
  onClose: () => void;
  onSelect: (type: DashboardCardType) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <section
        aria-labelledby="add-content-title"
        aria-modal="true"
        className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-gray-900 sm:p-8"
        role="dialog"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white" id="add-content-title">
              Add content
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Choose a card or button to add to your dashboard.
            </p>
          </div>
          <button
            aria-label="Close add content menu"
            className="rounded-lg px-3 py-1 text-2xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(cardTypeLabels).map(([key, label]) => {
            const type = key as DashboardCardType;
            const needsHomeAssistant =
              type === "home-assistant" ||
              type === "home-assistant-light" ||
              type === "home-assistant-fan" ||
              type === "home-assistant-thermostat" ||
              type === "home-assistant-dashboard";
            const disabled = needsHomeAssistant && !homeAssistantConfigured;
            return (
              <button
                className="rounded-xl border border-zinc-200 p-4 text-left transition hover:border-indigo-500 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-indigo-950/40"
                disabled={disabled}
                key={type}
                onClick={() => onSelect(type)}
                type="button"
              >
                <span className="block font-semibold text-zinc-900 dark:text-white">{label}</span>
                <span className="mt-1 block text-sm text-zinc-500">
                  {disabled
                    ? "Configure Home Assistant first."
                    : cardTypeDescriptions[type]}
                </span>
              </button>
            );
          })}
        </div>
        {!homeAssistantConfigured && (
          <p className="mt-5 text-sm text-zinc-500">
            The admin can connect Home Assistant from dashboard edit mode.
          </p>
        )}
      </section>
    </div>
  );
}

function errorMessage(payload: unknown, fallback: string) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }
  return fallback;
}

function weatherCondition(value: unknown) {
  if (typeof value === "string") {
    const homeAssistantConditions: Record<string, string> = {
      "clear-night": "Clear night",
      "partlycloudy": "Partly cloudy",
      "lightning-rainy": "Thunderstorms and rain",
      "snowy-rainy": "Snow and rain",
      "windy-variant": "Windy and cloudy",
    };
    if (homeAssistantConditions[value]) return homeAssistantConditions[value];
    return value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
  if (typeof value !== "number") return "—";
  if (value === 0) return "Clear";
  if (value <= 3) return ["", "Mainly clear", "Partly cloudy", "Overcast"][value];
  if (value === 45 || value === 48) return "Fog";
  if (value <= 57) return "Drizzle";
  if (value <= 67) return "Rain";
  if (value <= 77) return "Snow";
  if (value <= 82) return "Rain showers";
  if (value <= 86) return "Snow showers";
  if (value <= 99) return "Thunderstorm";
  return "—";
}

function ThemeCustomizationModal({
  config,
  onClose,
  onSave,
}: {
  config: ThemeConfig;
  onClose: () => void;
  onSave: (config: ThemeConfig) => Promise<void>;
}) {
  const [draft, setDraft] = useState(config);
  const [wallpaperInput, setWallpaperInput] = useState(
    wallpaperUrlFromBackground(config.backgroundImage),
  );
  const [wallpaperError, setWallpaperError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const inputClass =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white";
  const selectedPreset =
    themePresets.find((preset) => preset.presetId === draft.presetId) ??
    { name: "Custom", description: "Your colors and wallpaper" };
  const previewBackgroundImage = draft.backgroundImage;

  const applyTheme = async () => {
    setIsSaving(true);
    setWallpaperError("");
    try {
      await onSave({ ...draft, mode: config.mode ?? "light" });
      onClose();
    } catch (error) {
      setWallpaperError(
        error instanceof Error ? error.message : "Unable to save this theme.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-md sm:p-6">
      <section
        aria-labelledby="theme-title"
        aria-modal="true"
        className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 shadow-2xl dark:border-zinc-700 dark:bg-zinc-950"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800 sm:px-7">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white" id="theme-title">
              Desktop themes
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Choose a color palette and matching wallpaper for your desktop.
            </p>
          </div>
          <button
            aria-label="Close themes"
            className="rounded-lg px-2 py-1 text-xl text-zinc-500 transition hover:bg-zinc-200 dark:hover:bg-zinc-800"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-5 sm:px-7">
          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <div
              aria-label="Live desktop theme preview"
              className="relative aspect-[16/8] overflow-hidden rounded-2xl border border-zinc-300 shadow-inner dark:border-zinc-700"
              role="img"
              style={{
                backgroundColor: draft.bgColor,
                backgroundImage:
                  previewBackgroundImage === "none"
                    ? undefined
                    : previewBackgroundImage,
                backgroundPosition: "center",
                backgroundSize: "cover",
              }}
            >
              <div className="absolute inset-0 bg-black/15" />
              <div className="relative flex items-center justify-between gap-2 p-3 text-white sm:p-4">
                <span
                  className="text-sm font-black tracking-tight sm:text-lg"
                  style={{ color: draft.primaryColor }}
                >
                  Evil-Lander
                </span>
                <span className="flex gap-1.5">
                  {["Home", "Media"].map((label, index) => (
                    <span
                      className="rounded-full border px-2.5 py-1 text-[9px] font-semibold sm:text-[10px]"
                      key={label}
                      style={{
                        borderColor:
                          index === 0 ? draft.primaryColor : "rgba(255,255,255,.45)",
                        color: "white",
                      }}
                    >
                      {label}
                    </span>
                  ))}
                </span>
                <span
                  className="hidden rounded-lg border px-2.5 py-1 text-[10px] font-semibold sm:inline"
                  style={{ borderColor: draft.primaryColor, color: "white" }}
                >
                  Edit dashboard
                </span>
              </div>
              <div className="absolute bottom-3 left-3 w-36 rounded-xl border border-white/35 bg-white/20 p-3 text-white shadow-lg backdrop-blur-xl sm:bottom-4 sm:left-4 sm:w-44 sm:p-4">
                <span className="text-[9px] font-medium uppercase tracking-wider text-white/75 sm:text-[10px]">
                  Weather
                </span>
                <span className="mt-1 block text-2xl font-semibold sm:text-3xl">72°</span>
                <span className="mt-1 block text-[10px] text-white/80">Clear skies</span>
              </div>
              <div
                className="absolute bottom-3 right-3 rounded-full border px-2.5 py-1 text-[9px] font-semibold text-white sm:bottom-4 sm:right-4 sm:px-3 sm:text-[10px]"
                style={{ borderColor: draft.primaryColor }}
              >
                + Add object
              </div>
            </div>
            <div className="flex flex-col justify-center rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Live preview
              </span>
              <h3 className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">
                {selectedPreset.name}
              </h3>
              <p className="mt-1 text-sm text-zinc-500">{selectedPreset.description}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {[
                  { label: "Accent", value: draft.primaryColor },
                  { label: "Background", value: draft.bgColor },
                ].map(({ label, value }) => (
                  <span className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300" key={label}>
                    <span
                      aria-hidden="true"
                      className="h-5 w-5 rounded-full border border-zinc-300 shadow-inner dark:border-zinc-600"
                      style={{ backgroundColor: value }}
                    />
                    {label}
                    <span className="font-mono text-[10px] text-zinc-500">{value}</span>
                  </span>
                ))}
              </div>
              <p className="mt-4 text-xs leading-relaxed text-zinc-500">
                The preview updates as you choose a preset, color, or wallpaper.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {themePresets.map((preset) => (
              <button
                aria-pressed={draft.presetId === preset.presetId}
                className={`group overflow-hidden rounded-xl border text-left transition ${
                  draft.presetId === preset.presetId
                    ? "border-indigo-500 ring-2 ring-indigo-500/30"
                    : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500"
                }`}
                key={preset.presetId}
                onClick={() => {
                  setDraft(preset);
                  setWallpaperInput(wallpaperUrlFromBackground(preset.backgroundImage));
                  setWallpaperError("");
                }}
                type="button"
              >
                <span
                  className="relative block h-20 overflow-hidden"
                  style={{
                    backgroundColor: preset.bgColor,
                    backgroundImage: preset.backgroundImage,
                    backgroundSize: "cover",
                  }}
                >
                  <span
                    className="absolute bottom-2 left-2 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide text-white shadow"
                    style={{ backgroundColor: preset.primaryColor }}
                  >
                    Evil-Lander
                  </span>
                  <span className="absolute bottom-2 right-2 flex gap-1">
                    {[preset.primaryColor, "#ffffff", preset.bgColor].map((color) => (
                      <span
                        className="h-3 w-3 rounded-full border border-white/50 shadow"
                        key={color}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </span>
                </span>
                <span className="flex items-center justify-between gap-2 bg-white px-3 py-2.5 dark:bg-zinc-900">
                  <span>
                    <span className="block text-sm font-semibold text-zinc-900 dark:text-white">
                      {preset.name}
                    </span>
                    <span className="block text-xs text-zinc-500">{preset.description}</span>
                  </span>
                  {draft.presetId === preset.presetId && (
                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                      Selected
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Make it yours</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Pick colors visually, then choose a wallpaper file or enter an image URL.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
                <input
                  aria-label="Custom accent color"
                  className="h-10 w-12 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      presetId: "custom",
                      primaryColor: event.target.value,
                    }))
                  }
                  type="color"
                  value={draft.primaryColor}
                />
                <span>
                  <span className="block">Accent color</span>
                  <span className="text-xs font-normal text-zinc-500">{draft.primaryColor}</span>
                </span>
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
                <input
                  aria-label="Desktop background color"
                  className="h-10 w-12 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      presetId: "custom",
                      bgColor: event.target.value,
                    }))
                  }
                  type="color"
                  value={draft.bgColor}
                />
                <span>
                  <span className="block">Background color</span>
                  <span className="text-xs font-normal text-zinc-500">{draft.bgColor}</span>
                </span>
              </label>
            </div>
            <label className="mt-4 block text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="theme-wallpaper-url">
              Wallpaper image URL
              <input
                className={`${inputClass} mt-1`}
                id="theme-wallpaper-url"
                onChange={(event) => {
                  const value = event.target.value;
                  setWallpaperInput(value);
                  const backgroundImage = wallpaperBackgroundFromInput(value);
                  setWallpaperError(
                    backgroundImage === null
                      ? "Use an https:// image URL or a site path such as /wallpaper.jpg."
                      : "",
                  );
                  if (backgroundImage !== null) {
                    setDraft((current) => ({
                      ...current,
                      presetId: "custom",
                      backgroundImage,
                    }));
                  }
                }}
                placeholder="https://example.com/wallpaper.jpg or /wallpaper.jpg"
                value={wallpaperInput}
              />
              {wallpaperError && (
                <span className="mt-1 block text-xs text-red-600" role="alert">
                  {wallpaperError}
                </span>
              )}
            </label>
            <label className="mt-4 block text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="theme-wallpaper-file">
              Or choose a wallpaper from your device
              <input
                accept="image/png,image/jpeg,image/webp,image/gif"
                className={`${inputClass} mt-1 file:mr-3 file:rounded-md file:border-0 file:bg-transparent file:px-2 file:py-1 file:font-semibold`}
                id="theme-wallpaper-file"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (!file) return;
                  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
                    setWallpaperError("Choose a PNG, JPEG, WebP, or GIF wallpaper.");
                    return;
                  }
                  if (file.size > 64 * 1024 * 1024) {
                    setWallpaperError("Theme wallpapers must be 64 MiB or smaller.");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    if (typeof reader.result !== "string") {
                      setWallpaperError("The selected wallpaper could not be read.");
                      return;
                    }
                    setDraft((current) => ({
                      ...current,
                      presetId: "custom",
                      backgroundImage: `url("${reader.result}")`,
                    }));
                    setWallpaperInput("");
                    setWallpaperError("");
                  };
                  reader.onerror = () =>
                    setWallpaperError("The selected wallpaper could not be read.");
                  reader.readAsDataURL(file);
                }}
                type="file"
              />
              <span className="mt-1 block text-xs font-normal text-zinc-500">
                Wallpaper images up to 64 MiB are saved in your server-side user settings file.
              </span>
            </label>
            {draft.backgroundImage !== "none" && (
              <button
                className="mt-2 rounded-lg border border-zinc-300 bg-transparent px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:border-red-400 hover:text-red-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-red-300"
                onClick={() => {
                  setWallpaperInput("");
                  setWallpaperError("");
                  setDraft((current) => ({
                    ...current,
                    presetId: "custom",
                    backgroundImage: "none",
                  }));
                }}
                type="button"
              >
                Remove wallpaper image
              </button>
            )}
          </div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800 sm:px-7">
          <button
            className="rounded-lg border border-zinc-300 bg-transparent px-4 py-2 text-sm font-medium transition hover:border-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-500"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-lg border px-4 py-2 text-sm font-semibold transition hover:bg-transparent"
            onClick={() => void applyTheme()}
            disabled={Boolean(wallpaperError) || isSaving}
            style={{
              backgroundColor: "transparent",
              borderColor: draft.primaryColor,
              color: draft.primaryColor,
            }}
            type="button"
          >
            {isSaving ? "Saving…" : "Apply theme"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function CardEditorModal({
  card,
  homeAssistantConfigured,
  homeAssistantBaseUrl,
  onClose,
  onSave,
}: {
  card: CardDraft;
  homeAssistantConfigured: boolean;
  homeAssistantBaseUrl: string;
  onClose: () => void;
  onSave: (card: CardDraft) => Promise<void>;
}) {
  const [type, setType] = useState(card.type);
  const [title, setTitle] = useState(card.title);
  const [config, setConfig] = useState<Record<string, string>>(card.config);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const setValue = (key: string, value: string) => {
    setConfig((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSave({
        id: card.id,
        sectionId: card.sectionId,
        type,
        title: title.trim(),
        config,
        colSpan: card.colSpan,
        rowSpan: card.rowSpan,
        floatX: card.floatX,
        floatY: card.floatY,
        floatWidth: card.floatWidth,
        floatHeight: card.floatHeight,
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save the card.",
      );
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-zinc-300 bg-gray-50 p-3 text-zinc-900 focus:border-indigo-500 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-gray-700 dark:text-white";
  const canChooseDesktopDisplay = desktopWidgetTypes.includes(type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <section
        aria-labelledby="card-editor-title"
        aria-modal="true"
        className="my-auto w-full max-w-xl rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-gray-800 sm:p-8"
        role="dialog"
      >
        <h2
          className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white"
          id="card-editor-title"
        >
          {card.id ? "Edit object" : "Add an object"}
        </h2>
        {error && (
          <p className="mb-4 rounded bg-red-100 p-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium">
            Card type
            <select
              className={`${inputClass} mt-1`}
              onChange={(event) => setType(event.target.value as DashboardCardType)}
              value={type}
            >
              {Object.entries(cardTypeLabels).map(([value, label]) => (
                <option
                  disabled={
                    (value === "home-assistant" ||
                      value === "home-assistant-light" ||
                      value === "home-assistant-fan" ||
                      value === "home-assistant-dashboard") &&
                    !homeAssistantConfigured
                  }
                  key={value}
                  value={value}
                >
                  {label}
                </option>
              ))}
            </select>
          </label>
          {(type === "home-assistant" ||
            type === "home-assistant-light" ||
            type === "home-assistant-fan" ||
            type === "home-assistant-thermostat") &&
            !homeAssistantConfigured && (
            <p className="text-sm text-amber-700">
              The dashboard admin must configure Home Assistant in Settings first.
            </p>
          )}
          {type === "home-assistant-light" && (
            <>
              <label className="block text-sm font-medium">
                Light entity ID
                <input
                  className={`${inputClass} mt-1`}
                  onChange={(event) => setValue("entityId", event.target.value)}
                  pattern="light\.[A-Za-z0-9_]+"
                  placeholder="light.office_fan_main_light"
                  required
                  value={config.entityId ?? ""}
                />
              </label>
              <p className="text-xs text-zinc-500">
                Brightness, color, and white-temperature controls are shown when supported by this light.
              </p>
            </>
          )}
          {type === "home-assistant-fan" && (
            <>
              <label className="block text-sm font-medium">
                Fan entity ID
                <input
                  className={`${inputClass} mt-1`}
                  onChange={(event) => setValue("entityId", event.target.value)}
                  pattern="fan\.[A-Za-z0-9_]+"
                  placeholder="fan.office_ceiling_fan"
                  required
                  value={config.entityId ?? ""}
                />
              </label>
              <p className="text-xs text-zinc-500">
                Power, speed, and direction controls appear in the device flyout when supported.
              </p>
            </>
          )}
          {type === "home-assistant-thermostat" && (
            <>
              <label className="block text-sm font-medium">
                Thermostat entity ID
                <input
                  className={`${inputClass} mt-1`}
                  onChange={(event) => setValue("entityId", event.target.value)}
                  pattern="climate\.[A-Za-z0-9_]+"
                  placeholder="climate.house"
                  required
                  value={config.entityId ?? ""}
                />
              </label>
              <p className="text-xs text-zinc-500">
                Opens an interactive thermostat with target temperature and supported HVAC modes.
              </p>
            </>
          )}
          <label className="block text-sm font-medium">
            Card title
            <input
              autoFocus
              className={`${inputClass} mt-1`}
              maxLength={80}
              onChange={(event) => setTitle(event.target.value)}
              required
              value={title}
            />
          </label>
          {canChooseDesktopDisplay && (
            <label className="block text-sm font-medium">
              Desktop display
              <select
                className={`${inputClass} mt-1`}
                onChange={(event) => setValue("displayMode", event.target.value)}
                value={config.displayMode ?? defaultDesktopDisplay(type)}
              >
                <option value="widget">Show as a widget on the desktop</option>
                <option value="button">Show as an icon that opens a modal</option>
              </select>
            </label>
          )}
          <label className="block text-sm font-medium">
            Custom icon image URL (optional)
            <input
              className={`${inputClass} mt-1`}
              onChange={(event) => setValue("iconUrl", event.target.value)}
              placeholder="https://example.com/icon.png"
              type="url"
              value={config.iconUrl ?? ""}
            />
            <span className="mt-1 block text-xs font-normal text-zinc-500">
              Link and iframe icons use the site&apos;s favicon when no custom image is set.
            </span>
          </label>

          {type === "markdown" && (
            <label className="block text-sm font-medium">
              Markdown content
              <textarea
                className={`${inputClass} mt-1 min-h-36`}
                maxLength={10000}
                onChange={(event) => setValue("markdown", event.target.value)}
                placeholder={"## Notes\nAdd links, lists, or **formatted text**"}
                value={config.markdown ?? ""}
              />
            </label>
          )}
          {(type === "link" || type === "button") && (
            <>
              <label className="block text-sm font-medium">
                URL
                <input
                  className={`${inputClass} mt-1`}
                  onChange={(event) => setValue("url", event.target.value)}
                  placeholder="https://service.example.com"
                  required
                  type="url"
                  value={config.url ?? ""}
                />
              </label>
              {type === "button" && (
                <label className="block text-sm font-medium">
                  Button label
                  <input
                    className={`${inputClass} mt-1`}
                    maxLength={60}
                    onChange={(event) => setValue("label", event.target.value)}
                    value={config.label ?? "Open"}
                  />
                </label>
              )}
              <label className="block text-sm font-medium">
                Description
                <input
                  className={`${inputClass} mt-1`}
                  maxLength={240}
                  onChange={(event) => setValue("description", event.target.value)}
                  value={config.description ?? ""}
                />
              </label>
            </>
          )}
          {type === "image" && (
            <>
              <label className="block text-sm font-medium">
                Image URL
                <input
                  className={`${inputClass} mt-1`}
                  onChange={(event) => setValue("url", event.target.value)}
                  placeholder="https://example.com/image.jpg"
                  required
                  type="url"
                  value={config.url ?? ""}
                />
              </label>
              <label className="block text-sm font-medium">
                Alt text
                <input
                  className={`${inputClass} mt-1`}
                  maxLength={200}
                  onChange={(event) => setValue("alt", event.target.value)}
                  value={config.alt ?? ""}
                />
              </label>
            </>
          )}
          {type === "embed" && (
            <label className="block text-sm font-medium">
              Website URL
              <input
                className={`${inputClass} mt-1`}
                onChange={(event) => setValue("url", event.target.value)}
                placeholder="https://example.com/embed"
                required
                type="url"
                value={config.url ?? ""}
              />
            </label>
          )}
          {type === "weather" && (
            <>
              <label className="block text-sm font-medium">
                Weather source
                <select
                  className={`${inputClass} mt-1`}
                  onChange={(event) => {
                    const provider = event.target.value;
                    setConfig((current) => ({
                      ...current,
                      provider,
                      ...(provider === "home-assistant"
                        ? { entityId: current.entityId ?? "", location: "" }
                        : { location: current.location ?? "", entityId: "" }),
                    }));
                  }}
                  value={config.provider ?? "open-meteo"}
                >
                  <option value="home-assistant" disabled={!homeAssistantConfigured}>
                    Home Assistant
                  </option>
                  <option value="open-meteo">Open-Meteo</option>
                </select>
              </label>
              {config.provider === "home-assistant" ? (
                <>
                  <label className="block text-sm font-medium">
                    Weather entity ID
                    <input
                      className={`${inputClass} mt-1`}
                      onChange={(event) => setValue("entityId", event.target.value)}
                      pattern="weather\.[A-Za-z0-9_]+"
                      placeholder="weather.home"
                      required
                      value={config.entityId ?? ""}
                    />
                  </label>
                  {!homeAssistantConfigured && (
                    <p className="text-sm text-amber-700">
                      The dashboard admin must configure Home Assistant first.
                    </p>
                  )}
                </>
              ) : (
                <label className="block text-sm font-medium">
                  Location
                  <input
                    className={`${inputClass} mt-1`}
                    maxLength={100}
                    onChange={(event) => setValue("location", event.target.value)}
                    placeholder="City, country"
                    required
                    value={config.location ?? ""}
                  />
                </label>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium">
                  Units
                  <select
                    className={`${inputClass} mt-1`}
                    onChange={(event) => setValue("units", event.target.value)}
                    value={config.units ?? "imperial"}
                  >
                    <option value="imperial">Imperial (°F, mph, inches)</option>
                    <option value="metric">Metric (°C, km/h, mm)</option>
                  </select>
                </label>
                <label className="block text-sm font-medium">
                  Forecast
                  <select
                    className={`${inputClass} mt-1`}
                    onChange={(event) => setValue("forecastType", event.target.value)}
                    value={config.forecastType ?? "daily"}
                  >
                    <option value="daily">Daily</option>
                    <option value="hourly">Hourly</option>
                    {config.provider === "home-assistant" && (
                      <option value="twice_daily">Twice daily</option>
                    )}
                  </select>
                </label>
              </div>
            </>
          )}
          {type === "home-assistant" && (
            <label className="block text-sm font-medium">
              Entity ID
              <input
                className={`${inputClass} mt-1`}
                onChange={(event) => setValue("entityId", event.target.value)}
                placeholder="sensor.living_room_temperature"
                required
                value={config.entityId ?? ""}
              />
            </label>
          )}
          {type === "home-assistant-dashboard" && (
            <>
              <p className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-100">
                This embeds Home Assistant directly, so its native dashboard cards and controls render in Home Assistant. Sign in to Home Assistant in this browser. If it is behind Nginx Proxy Manager, enable Websockets Support on its proxy host and disable Home Assistant&apos;s HTTP setting **Send X-Frame-Options** to allow this dashboard to embed it.
              </p>
              <p className="break-all text-xs text-zinc-500">
                Connected server: {homeAssistantBaseUrl}
              </p>
              <label className="block text-sm font-medium">
                Dashboard view path
                <input
                  className={`${inputClass} mt-1`}
                  onChange={(event) => setValue("path", event.target.value)}
                  placeholder="/lovelace/0"
                  required
                  value={config.path ?? "/lovelace/0"}
                />
              </label>
            </>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              className="rounded-full border border-zinc-300 px-5 py-2 text-sm dark:border-zinc-600"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={saving}
              type="submit"
            >
              {saving ? "Saving…" : card.id ? "Save object" : "Add object"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function HomeAssistantSettingsModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (baseUrl: string) => void;
}) {
  const [baseUrl, setBaseUrl] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/dashboard/settings", { signal: controller.signal })
      .then(async (response) => {
        const result: { homeAssistantBaseUrl?: string; error?: string } =
          await response.json();
        if (!response.ok) throw new Error(result.error ?? "Unable to load settings.");
        return result.homeAssistantBaseUrl ?? "";
      })
      .then(setBaseUrl)
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load settings.");
        }
      });
    return () => controller.abort();
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/dashboard/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, token }),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save settings.");
      onSaved(baseUrl.replace(/\/+$/, ""));
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <section
        aria-labelledby="ha-settings-title"
        aria-modal="true"
        className="w-full max-w-lg rounded-xl bg-white p-7 shadow-2xl dark:bg-gray-800"
        role="dialog"
      >
        <h2 className="mb-3 text-2xl font-bold" id="ha-settings-title">
          Home Assistant connection
        </h2>
        <p className="mb-5 text-sm text-zinc-600 dark:text-zinc-300">
          Configure once to enable entity cards on the dashboard. The access token is encrypted at rest and never sent back to the browser.
        </p>
        {error && <p className="mb-4 text-sm text-red-600" role="alert">{error}</p>}
        <form className="space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium">
            Server URL
            <input
              autoFocus
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-gray-50 p-3 text-zinc-900 dark:border-zinc-600 dark:bg-gray-700 dark:text-white"
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="http://homeassistant.local:8123"
              required
              type="url"
              value={baseUrl}
            />
          </label>
          <label className="block text-sm font-medium">
            Long-lived access token
            <input
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-gray-50 p-3 text-zinc-900 dark:border-zinc-600 dark:bg-gray-700 dark:text-white"
              onChange={(event) => setToken(event.target.value)}
              placeholder="Leave blank to keep the saved token"
              type="password"
              value={token}
            />
          </label>
          <p className="text-xs text-zinc-500">
            Set the server-side AUTH_ENCRYPTION_KEY to a randomly generated 32-byte hex key before saving credentials.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              className="rounded-full border border-zinc-300 px-5 py-2 text-sm dark:border-zinc-600"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={saving}
              type="submit"
            >
              {saving ? "Saving…" : "Save connection"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function LiveCardData({ card }: { card: DashboardCard }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/dashboard/cards/${encodeURIComponent(card.id)}/data`);
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(errorMessage(result, "Live data is unavailable."));
      if (typeof result !== "object" || result === null || Array.isArray(result)) {
        throw new Error("The data provider returned an invalid response.");
      }
      setData(result as Record<string, unknown>);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Live data is unavailable.");
    }
  }, [card.id]);

  const controlHomeAssistant = async (
    control: { action: string; value?: number | number[] | string },
  ) => {
    try {
      const response = await fetch(
        `/api/dashboard/cards/${encodeURIComponent(card.id)}/data`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(control),
        },
      );
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(errorMessage(result, "Unable to control this Home Assistant device."));
      }
      if (typeof result !== "object" || result === null || Array.isArray(result)) {
        throw new Error("Home Assistant returned invalid device data.");
      }
      setData(result as Record<string, unknown>);
      setError("");
    } catch (controlError) {
      setError(
        controlError instanceof Error
          ? controlError.message
          : "Unable to control this Home Assistant device.",
      );
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/dashboard/cards/${encodeURIComponent(card.id)}/data`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok) throw new Error(errorMessage(result, "Live data is unavailable."));
        if (typeof result !== "object" || result === null || Array.isArray(result)) {
          throw new Error("The data provider returned an invalid response.");
        }
        return result as Record<string, unknown>;
      })
      .then((result) => {
        setData(result);
        setError("");
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error ? loadError.message : "Live data is unavailable.",
          );
        }
      });
    return () => controller.abort();
  }, [card.id]);

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-amber-700 dark:text-amber-300">{error}</p>
        <button className="text-sm text-indigo-600 underline" onClick={() => void load()} type="button">
          Retry
        </button>
      </div>
    );
  }
  if (!data) return <p className="text-sm text-zinc-500">Loading live data…</p>;

  if (card.type === "home-assistant-light") {
    const rgb =
      Array.isArray(data.rgbColor) && data.rgbColor.length >= 3
        ? data.rgbColor.slice(0, 3).join(",")
        : "255,255,255";
    return (
      <HomeAssistantLightControls
        data={data}
        key={`${data.state}:${data.brightness}:${rgb}:${data.colorTempKelvin}`}
        onRefresh={() => void load()}
        onControl={controlHomeAssistant}
      />
    );
  }

  if (card.type === "home-assistant-fan") {
    return (
      <HomeAssistantFanControls
        data={data}
        key={`${data.state}:${data.percentage}:${data.direction}`}
        onRefresh={() => void load()}
        onControl={controlHomeAssistant}
      />
    );
  }
  if (card.type === "home-assistant-thermostat") {
    return (
      <HomeAssistantThermostatControls
        data={data}
        key={`${data.state}:${data.temperature}:${data.hvacAction}`}
        onRefresh={() => void load()}
        onControl={controlHomeAssistant}
      />
    );
  }
  if (card.type === "weather") {
    const current =
      typeof data.current === "object" && data.current !== null
        ? (data.current as Record<string, unknown>)
        : {};
    const units =
      typeof data.units === "object" && data.units !== null
        ? (data.units as Record<string, unknown>)
        : {};
    const forecast = Array.isArray(data.forecast)
      ? data.forecast.filter(
          (item): item is Record<string, unknown> =>
            typeof item === "object" && item !== null && !Array.isArray(item),
        )
      : [];
    const temperatureUnit = String(units.temperature ?? "°F");
    const windUnit = String(units.wind_speed ?? "mph");
    const precipitationUnit = String(units.precipitation ?? "in");
    const dateFormat = new Intl.DateTimeFormat(undefined, {
      ...(data.forecastType === "hourly"
        ? { weekday: "short" as const, hour: "numeric" as const }
        : data.forecastType === "twice_daily"
          ? { weekday: "short" as const, hour: "numeric" as const }
          : { weekday: "short" as const }),
    });
    return (
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-zinc-500">{String(data.location ?? card.config.location)}</p>
            <p className="mt-1 text-sm capitalize text-zinc-600 dark:text-zinc-300">
              {weatherCondition(data.condition)}
            </p>
          </div>
          <button
            className="text-sm text-indigo-600 underline"
            onClick={() => void load()}
            type="button"
          >
            Refresh
          </button>
        </div>
        <p className="mt-2 text-4xl font-semibold">
          {typeof current.temperature === "number"
            ? Math.round(current.temperature)
            : "—"}
          <span className="ml-1 text-xl">{temperatureUnit}</span>
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Feels like {typeof current.apparent_temperature === "number"
            ? `${Math.round(current.apparent_temperature)}${temperatureUnit}`
            : "—"}{" "}
          · Humidity {typeof current.humidity === "number" ? `${Math.round(current.humidity)}%` : "—"}{" "}
          · Wind {typeof current.wind_speed === "number"
            ? `${Math.round(current.wind_speed)} ${windUnit}`
            : "—"}
        </p>
        {forecast.length > 0 && (
          <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-700">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {data.forecastType === "hourly"
                ? "Hourly forecast"
                : data.forecastType === "twice_daily"
                  ? "Twice-daily forecast"
                  : "5-day forecast"}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {forecast.map((item, index) => {
                const datetime =
                  typeof item.datetime === "string" ? new Date(item.datetime) : null;
                const dateLabel =
                  datetime && !Number.isNaN(datetime.getTime())
                    ? dateFormat.format(datetime)
                    : `Period ${index + 1}`;
                const temperature =
                  typeof item.temperature === "number"
                    ? `${Math.round(item.temperature)}${temperatureUnit}`
                    : "—";
                const low =
                  typeof item.templow === "number"
                    ? ` / ${Math.round(item.templow)}${temperatureUnit}`
                    : "";
                return (
                  <div
                    className="rounded-lg bg-zinc-100 p-2 dark:bg-zinc-800"
                    key={`${String(item.datetime)}-${index}`}
                  >
                    <p className="text-xs font-medium">{dateLabel}</p>
                    <p className="mt-1 text-xs capitalize text-zinc-500">
                      {weatherCondition(item.condition)}
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {temperature}{low}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {typeof item.precipitation_probability === "number"
                        ? `${Math.round(item.precipitation_probability)}% precip`
                        : "—"}
                      {typeof item.wind_speed === "number"
                        ? ` · ${Math.round(item.wind_speed)} ${windUnit}`
                        : ""}
                      {typeof item.precipitation === "number"
                        ? ` · ${item.precipitation.toFixed(2)} ${precipitationUnit}`
                        : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {card.config.provider !== "home-assistant" && (
          <a
            className="mt-2 inline-block text-xs text-zinc-500 underline"
            href="https://open-meteo.com/"
            rel="noopener noreferrer"
            target="_blank"
          >
            Weather by Open-Meteo
          </a>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-zinc-500">{String(data.friendlyName ?? card.config.entityId)}</p>
      <p className="mt-2 text-3xl font-semibold">
        {String(data.state ?? "unknown")}
        <span className="ml-1 text-lg">{String(data.unit ?? "")}</span>
      </p>
      {typeof data.lastChanged === "string" && data.lastChanged && (
        <p className="mt-2 text-xs text-zinc-500">
          Updated {new Date(data.lastChanged).toLocaleString()}
        </p>
      )}
      <button className="mt-3 text-sm text-indigo-600 underline" onClick={() => void load()} type="button">
        Refresh
      </button>
    </div>
  );
}

function ClockWidget() {
  const currentSecond = useSyncExternalStore(
    subscribeToClock,
    getClockSnapshot,
    getClockServerSnapshot,
  );
  const now = new Date(currentSecond * 1000);

  return (
    <div className="flex min-w-64 flex-col items-center justify-center rounded-xl border border-white/25 bg-slate-950/30 px-6 py-7 text-center text-white shadow-lg shadow-black/10 backdrop-blur-2xl">
      <time className="text-5xl font-light tabular-nums tracking-tight sm:text-6xl" dateTime={currentSecond ? now.toISOString() : undefined}>
        {currentSecond
          ? new Intl.DateTimeFormat(undefined, {
              hour: "numeric",
              minute: "2-digit",
              second: "2-digit",
            }).format(now)
          : "--:--:--"}
      </time>
      <p className="mt-3 text-sm font-medium tracking-wide text-indigo-200">
        {currentSecond
          ? new Intl.DateTimeFormat(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            }).format(now)
          : " "}
      </p>
      <p className="mt-1 text-xs text-slate-400">
        {currentSecond
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : " "}
      </p>
    </div>
  );
}

function CalendarWidget() {
  const currentSecond = useSyncExternalStore(
    subscribeToClock,
    getClockSnapshot,
    getClockServerSnapshot,
  );
  const [monthOffset, setMonthOffset] = useState(0);

  const today = new Date(currentSecond * 1000);
  const month = new Date(
    today.getFullYear(),
    today.getMonth() + monthOffset,
    1,
  );
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const firstWeekday = month.getDay();
  const dayCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="w-full min-w-64 rounded-xl border border-white/25 bg-slate-950/30 p-4 text-white shadow-lg shadow-black/10 backdrop-blur-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          aria-label="Previous month"
          className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-indigo-200 transition hover:bg-white/10 hover:text-white"
          onClick={() => setMonthOffset((offset) => offset - 1)}
          type="button"
        >
          ‹
        </button>
        <h3 className="text-sm font-semibold tracking-wide">
          {currentSecond
            ? new Intl.DateTimeFormat(undefined, {
                month: "long",
                year: "numeric",
              }).format(month)
            : "Calendar"}
        </h3>
        <button
          aria-label="Next month"
          className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-indigo-200 transition hover:bg-white/10 hover:text-white"
          onClick={() => setMonthOffset((offset) => offset + 1)}
          type="button"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdays.map((weekday, index) => (
          <span
            className="pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400"
            key={`${weekday}-${index}`}
          >
            {weekday}
          </span>
        ))}
        {Array.from({ length: dayCount }, (_, index) => {
          const day = index - firstWeekday + 1;
          const isCurrentDay =
            currentSecond > 0 &&
            month.getFullYear() === today.getFullYear() &&
            month.getMonth() === today.getMonth() &&
            day === today.getDate();
          return (
            <span
              className={`flex aspect-square items-center justify-center rounded-full text-xs tabular-nums ${
                day < 1 || day > daysInMonth
                  ? "text-transparent"
                  : isCurrentDay
                    ? "bg-indigo-500 font-bold text-white shadow-md shadow-indigo-950/40"
                    : "text-slate-200"
              }`}
              key={index}
            >
              {day >= 1 && day <= daysInMonth ? day : ""}
            </span>
          );
        })}
      </div>
      {monthOffset !== 0 && (
        <button
          className="mt-3 w-full rounded-lg py-1.5 text-xs font-medium text-indigo-200 transition hover:bg-white/10 hover:text-white"
          onClick={() => setMonthOffset(0)}
          type="button"
        >
          Return to today
        </button>
      )}
    </div>
  );
}

export function DashboardCardContent({
  card,
  homeAssistantBaseUrl,
}: {
  card: DashboardCard;
  homeAssistantBaseUrl: string;
}) {
  if (card.type === "clock") return <ClockWidget />;
  if (card.type === "calendar") return <CalendarWidget />;
  if (card.type === "markdown") {
    return (
      <div className="prose prose-zinc max-w-none dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.config.markdown ?? ""}</ReactMarkdown>
      </div>
    );
  }
  if (card.type === "link") {
    return (
      <div>
        {card.config.description && (
          <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-300">{card.config.description}</p>
        )}
        <a
          className="text-indigo-600 underline dark:text-indigo-300"
          href={card.config.url}
          rel="noopener noreferrer"
          target="_blank"
        >
          Open link
        </a>
      </div>
    );
  }
  if (card.type === "button") {
    return (
      <a
        className="inline-flex rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700"
        href={card.config.url}
        rel="noopener noreferrer"
        target="_blank"
      >
        {card.config.label || "Open"}
      </a>
    );
  }
  if (card.type === "image") {
    return (
      <Image
        alt={card.config.alt ?? ""}
        className="max-h-[75vh] max-w-full rounded-lg object-contain"
        height={900}
        src={card.config.url}
        unoptimized
        width={1200}
      />
    );
  }
  if (card.type === "embed") {
    return <WebsiteEmbed title={card.title} url={card.config.url} />;
  }
  if (card.type === "home-assistant-dashboard") {
    const dashboardUrl = new URL(card.config.path || "/lovelace/0", `${homeAssistantBaseUrl}/`);
    return (
      <iframe
        className="block h-full min-h-0 w-full border-0 bg-white"
        referrerPolicy="strict-origin-when-cross-origin"
        src={dashboardUrl.toString()}
        title={card.title}
      />
    );
  }
  if (
    card.type === "weather" ||
    card.type === "home-assistant" ||
    card.type === "home-assistant-light" ||
    card.type === "home-assistant-fan" ||
    card.type === "home-assistant-thermostat"
  ) {
    return <LiveCardData card={card} />;
  }
  return null;
}

function WebsiteEmbed({ url, title }: { url: string; title: string }) {
  const pageOrigin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => null,
  );
  const isCrossOrigin =
    pageOrigin !== null && new URL(url, `${pageOrigin}/`).origin !== pageOrigin;

  return (
    <iframe
      className="block h-full min-h-0 w-full border-0 bg-white"
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      sandbox={`allow-forms allow-popups allow-scripts${isCrossOrigin ? " allow-same-origin" : ""}`}
      src={url}
      title={title}
    />
  );
}

function getCardFaviconUrl(card: DashboardCard, homeAssistantBaseUrl: string) {
  if (card.config.iconUrl) return card.config.iconUrl;

  const siteUrl =
    card.type === "link" || card.type === "button" || card.type === "embed"
      ? card.config.url
      : card.type === "home-assistant-dashboard"
        ? homeAssistantBaseUrl
        : null;
  if (!siteUrl) return null;

  try {
    return new URL("/favicon.ico", siteUrl).toString();
  } catch {
    return null;
  }
}

function DesktopObjectIcon({
  card,
  homeAssistantBaseUrl,
  fallbackGlyph,
  fallbackColor,
  size = "large",
}: {
  card: DashboardCard;
  homeAssistantBaseUrl: string;
  fallbackGlyph: string;
  fallbackColor: string;
  size?: "small" | "large";
}) {
  const faviconUrl = getCardFaviconUrl(card, homeAssistantBaseUrl);
  const [failedFaviconUrl, setFailedFaviconUrl] = useState<string | null>(null);
  const faviconFailed = faviconUrl !== null && failedFaviconUrl === faviconUrl;

  const sizeClass = size === "small" ? "h-8 w-8 rounded-lg" : "h-16 w-16 rounded-2xl";
  const imageSize = size === "small" ? 32 : 64;

  return (
    <span
      aria-hidden="true"
      className={`flex ${sizeClass} items-center justify-center overflow-hidden ${
        faviconUrl && !faviconFailed
        ? "border border-white/35 bg-white/20 shadow-lg backdrop-blur-xl transition duration-200 group-hover:-translate-y-1 group-hover:scale-105 group-hover:shadow-xl dark:border-white/20 dark:bg-slate-950/30"
          : `bg-gradient-to-br ${fallbackColor} ${
              size === "small" ? "text-lg" : "text-3xl"
            } text-white shadow-lg transition duration-200 group-hover:-translate-y-1 group-hover:scale-105 group-hover:shadow-xl`
      }`}
    >
      {faviconUrl && !faviconFailed ? (
        <Image
          alt=""
          className={`h-full w-full object-contain ${size === "small" ? "p-1" : "p-2"}`}
          height={imageSize}
          onError={() => setFailedFaviconUrl(faviconUrl)}
          src={faviconUrl}
          unoptimized
          width={imageSize}
        />
      ) : (
        fallbackGlyph
      )}
    </span>
  );
}

function rgbToHue([red, green, blue]: [number, number, number]) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;
  const hue =
    max === r
      ? ((g - b) / delta) % 6
      : max === g
        ? (b - r) / delta + 2
        : (r - g) / delta + 4;
  return Math.round((hue * 60 + 360) % 360);
}

function hueToRgb(hue: number): [number, number, number] {
  const chroma = 1;
  const hueSection = hue / 60;
  const secondary = chroma * (1 - Math.abs((hueSection % 2) - 1));
  const channels: [number, number, number] =
    hueSection < 1
      ? [chroma, secondary, 0]
      : hueSection < 2
        ? [secondary, chroma, 0]
        : hueSection < 3
          ? [0, chroma, secondary]
          : hueSection < 4
            ? [0, secondary, chroma]
            : hueSection < 5
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary];
  const [red, green, blue] = channels.map((channel) => Math.round(channel * 255));
  return [red, green, blue];
}

function HomeAssistantLightControls({
  data,
  onControl,
  onRefresh,
}: {
  data: Record<string, unknown>;
  onControl: (control: { action: string; value?: number | number[] | string }) => void;
  onRefresh: () => void;
}) {
  const supported = (key: string) => data[key] === true;
  const initialBrightness =
    typeof data.brightness === "number" ? Math.min(255, Math.max(1, data.brightness)) : 255;
  const [brightness, setBrightness] = useState(initialBrightness);
  const initialRgbColor: [number, number, number] =
    Array.isArray(data.rgbColor) && data.rgbColor.length >= 3
      ? [
          Number(data.rgbColor[0]),
          Number(data.rgbColor[1]),
          Number(data.rgbColor[2]),
        ]
      : [255, 255, 255];
  const [rgbColor, setRgbColor] = useState(initialRgbColor);
  const [hue, setHue] = useState(rgbToHue(initialRgbColor));
  const minKelvin =
    typeof data.minKelvin === "number" ? data.minKelvin : 2000;
  const maxKelvin =
    typeof data.maxKelvin === "number" ? data.maxKelvin : 6500;
  const initialColorTemp =
    typeof data.colorTempKelvin === "number"
      ? Math.min(maxKelvin, Math.max(minKelvin, data.colorTempKelvin))
      : Math.round((minKelvin + maxKelvin) / 2);
  const [colorTemp, setColorTemp] = useState(initialColorTemp);
  const inputClass =
    "w-full accent-indigo-600 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{String(data.friendlyName ?? data.entityId)}</p>
          <p className="text-sm capitalize text-zinc-500">{String(data.state ?? "unknown")}</p>
        </div>
        <button
          aria-pressed={data.state === "on"}
          className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
            data.state === "on" ? "bg-amber-500 hover:bg-amber-600" : "bg-zinc-600 hover:bg-zinc-700"
          }`}
          onClick={() => onControl({ action: "toggle" })}
          type="button"
        >
          {data.state === "on" ? "Turn off" : "Turn on"}
        </button>
      </div>
      {supported("supportsBrightness") && (
        <label className="block text-sm">
          <span className="mb-1 flex justify-between">
            <span>Brightness</span>
            <span>{Math.round((brightness / 255) * 100)}%</span>
          </span>
          <input
            aria-label="Light brightness"
            className={inputClass}
            max={255}
            min={1}
            onChange={(event) => setBrightness(Number(event.target.value))}
            onPointerUp={(event) =>
              onControl({ action: "brightness", value: Number(event.currentTarget.value) })
            }
            onKeyUp={(event) =>
              onControl({ action: "brightness", value: Number(event.currentTarget.value) })
            }
            type="range"
            value={brightness}
          />
        </label>
      )}
      {supported("supportsColor") && (
        <label className="block space-y-2 text-sm">
          <span className="flex items-center justify-between gap-3">
            <span>Color</span>
            <span
              aria-label="Selected light color"
              className="inline-block h-4 w-4 rounded-full border border-zinc-400"
              style={{
                backgroundColor: `#${rgbColor
                  .map((channel) => channel.toString(16).padStart(2, "0"))
                  .join("")}`,
              }}
            />
          </span>
          <input
            aria-label="Light color"
            className="rainbow-hue-slider w-full cursor-pointer"
            max={359}
            min={0}
            onChange={(event) => {
              const nextHue = Number(event.target.value);
              setHue(nextHue);
              setRgbColor(hueToRgb(nextHue));
            }}
            onPointerUp={(event) =>
              onControl({ action: "color", value: hueToRgb(Number(event.currentTarget.value)) })
            }
            onKeyUp={(event) =>
              onControl({ action: "color", value: hueToRgb(Number(event.currentTarget.value)) })
            }
            type="range"
            value={hue}
          />
        </label>
      )}
      {supported("supportsColorTemp") && (
        <label className="block text-sm">
          <span className="mb-1 flex justify-between">
            <span>White temperature</span>
            <span>{colorTemp} K</span>
          </span>
          <input
            aria-label="White temperature"
            className={inputClass}
            max={maxKelvin}
            min={minKelvin}
            onChange={(event) => {
              setColorTemp(Number(event.target.value));
            }}
            onPointerUp={(event) =>
              onControl({ action: "color_temp", value: Number(event.currentTarget.value) })
            }
            onKeyUp={(event) =>
              onControl({ action: "color_temp", value: Number(event.currentTarget.value) })
            }
            type="range"
            value={colorTemp}
          />
          <span className="flex justify-between text-xs text-zinc-500">
            <span>Warm</span>
            <span>Cool</span>
          </span>
        </label>
      )}
      <button className="text-sm text-indigo-600 underline" onClick={onRefresh} type="button">
        Refresh
      </button>
    </div>
  );
}

function HomeAssistantFanControls({
  data,
  onControl,
  onRefresh,
}: {
  data: Record<string, unknown>;
  onControl: (control: { action: string; value?: number | number[] | string }) => void;
  onRefresh: () => void;
}) {
  const initialPercentage =
    typeof data.percentage === "number" ? Math.min(100, Math.max(1, data.percentage)) : 1;
  const [percentage, setPercentage] = useState(initialPercentage);
  const step =
    typeof data.percentageStep === "number" ? Math.min(100, Math.max(1, data.percentageStep)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{String(data.friendlyName ?? data.entityId)}</p>
          <p className="text-sm capitalize text-zinc-500">{String(data.state ?? "unknown")}</p>
        </div>
        <button
          aria-pressed={data.state === "on"}
          className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
            data.state === "on" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-zinc-600 hover:bg-zinc-700"
          }`}
          onClick={() => onControl({ action: "toggle" })}
          type="button"
        >
          {data.state === "on" ? "Turn off" : "Turn on"}
        </button>
      </div>
      <label className="block text-sm">
        <span className="mb-1 flex justify-between">
          <span>Fan speed</span>
          <span>{percentage}%</span>
        </span>
        <input
          aria-label="Fan speed"
          className="w-full accent-indigo-600"
          max={100}
          min={1}
          onChange={(event) => setPercentage(Number(event.target.value))}
          onPointerUp={(event) =>
            onControl({ action: "percentage", value: Number(event.currentTarget.value) })
          }
          onKeyUp={(event) =>
            onControl({ action: "percentage", value: Number(event.currentTarget.value) })
          }
          step={step}
          type="range"
          value={percentage}
        />
      </label>
      {data.supportsDirection === true && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-zinc-100 p-3 dark:bg-zinc-800">
          <div>
            <p className="text-sm font-medium">Fan direction</p>
            <p className="text-xs capitalize text-zinc-500">
              {String(data.direction ?? "forward")}
            </p>
          </div>
          <button
            aria-label="Reverse fan direction"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-white dark:border-zinc-600 dark:hover:bg-zinc-700"
            onClick={() =>
              onControl({
                action: "direction",
                value: data.direction === "reverse" ? "forward" : "reverse",
              })
            }
            type="button"
          >
            {data.direction === "reverse" ? "↻ Reverse" : "↺ Forward"}
          </button>
        </div>
      )}
      <button className="text-sm text-indigo-600 underline" onClick={onRefresh} type="button">
        Refresh
      </button>
    </div>
  );
}

function HomeAssistantThermostatControls({
  data,
  onControl,
  onRefresh,
}: {
  data: Record<string, unknown>;
  onControl: (control: { action: string; value?: number | number[] | string }) => void;
  onRefresh: () => void;
}) {
  const current =
    typeof data.currentTemperature === "number" ? data.currentTemperature : null;
  const target = typeof data.temperature === "number" ? data.temperature : null;
  const min = typeof data.minTemperature === "number" ? data.minTemperature : 5;
  const max = typeof data.maxTemperature === "number" ? data.maxTemperature : 35;
  const step = typeof data.temperatureStep === "number" ? data.temperatureStep : 0.5;
  const modes = Array.isArray(data.hvacModes)
    ? data.hvacModes.filter((mode): mode is string => typeof mode === "string")
    : [];
  const unit = String(data.temperatureUnit ?? "°C");
  const mode = String(data.state ?? "unknown");
  const hvacAction = String(data.hvacAction ?? "");

  const adjustTemperature = (direction: -1 | 1) => {
    const next = Math.max(
      min,
      Math.min(max, Number(((target ?? min) + direction * step).toFixed(1))),
    );
    onControl({ action: "temperature", value: next });
  };

  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-white/35 bg-white/20 shadow-xl shadow-black/10 backdrop-blur-2xl dark:border-white/15 dark:bg-slate-950/30">
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {String(data.friendlyName ?? data.entityId)}
          </p>
          <p className="mt-1 text-xs capitalize text-zinc-500">
            {hvacAction || mode}
          </p>
        </div>
        <button
          aria-label="Refresh thermostat"
          className="rounded-full border border-rose-300 bg-transparent px-3 py-1.5 text-xs font-medium text-rose-800 transition hover:border-rose-500 dark:border-rose-800 dark:text-rose-200"
          onClick={onRefresh}
          type="button"
        >
          Refresh
        </button>
      </div>
      <div className="px-5 pb-5">
        <div className="flex items-center justify-center gap-5 rounded-2xl border border-white/25 bg-white/20 px-4 py-5 backdrop-blur-lg dark:bg-black/15">
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Room</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-700 dark:text-zinc-200">
              {current === null ? "—" : current.toFixed(1)}
              <span className="ml-0.5 text-sm">{unit}</span>
            </p>
          </div>
          <div className="h-12 w-px bg-rose-200 dark:bg-zinc-700" />
          <div className="flex items-center gap-3">
            <button
              aria-label="Lower target temperature"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-rose-300 bg-transparent text-xl font-medium text-rose-700 transition hover:border-rose-500 dark:border-rose-800 dark:text-rose-200"
              disabled={target !== null && target <= min}
              onClick={() => adjustTemperature(-1)}
              type="button"
            >
              −
            </button>
            <div className="min-w-20 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Target
              </p>
              <p className="text-4xl font-bold tracking-tight text-rose-700 dark:text-rose-200">
                {target === null ? "—" : target.toFixed(1)}
                <span className="ml-0.5 text-base">{unit}</span>
              </p>
            </div>
            <button
              aria-label="Raise target temperature"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-rose-300 bg-transparent text-xl font-medium text-rose-700 transition hover:border-rose-500 dark:border-rose-800 dark:text-rose-200"
              disabled={target !== null && target >= max}
              onClick={() => adjustTemperature(1)}
              type="button"
            >
              +
            </button>
          </div>
        </div>
        {modes.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Mode
            </p>
            <div className="flex flex-wrap gap-2">
              {modes.map((hvacMode) => (
                <button
                  aria-pressed={mode === hvacMode}
                  className={`rounded-full px-3 py-2 text-xs font-semibold capitalize transition ${
                    mode === hvacMode
                      ? "border border-rose-500 bg-transparent text-rose-700 dark:border-rose-400 dark:text-rose-200"
                      : "border border-white/30 bg-transparent text-zinc-700 hover:border-rose-400 dark:border-white/20 dark:text-zinc-200"
                  }`}
                  key={hvacMode}
                  onClick={() => onControl({ action: "hvac_mode", value: hvacMode })}
                  type="button"
                >
                  {hvacMode.replaceAll("_", " ")}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DesktopObject({
  card,
  isEditMode,
  isCollapsed,
  onOpen,
  onToggleCollapsed,
  onMove,
  onPreview,
  onEdit,
  onDelete,
  homeAssistantBaseUrl,
}: {
  card: DashboardCard;
  isEditMode: boolean;
  isCollapsed: boolean;
  onOpen: () => void;
  onToggleCollapsed: () => void;
  onMove: (x: number, y: number, width?: number, height?: number) => void;
  onPreview: (x: number, y: number, width?: number, height?: number) => void;
  onEdit: () => void;
  onDelete: () => void;
  homeAssistantBaseUrl: string;
}) {
  const start = useRef<{
    pointerX: number;
    pointerY: number;
    canvasWidth: number;
    canvasHeight: number;
    objectWidth: number;
    objectHeight: number;
    maxX: number;
    x: number;
    y: number;
    nextX: number;
    nextY: number;
    moved: boolean;
  } | null>(null);
  const resizeStart = useRef<{
    pointerId: number;
    pointerX: number;
    pointerY: number;
    canvasWidth: number;
    nextX: number;
    width: number;
    height: number;
    nextWidth: number;
    nextHeight: number;
  } | null>(null);
  const suppressClick = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const icons: Record<DashboardCardType, { glyph: string; color: string }> = {
    markdown: { glyph: "✎", color: "from-slate-500 to-slate-700" },
    link: { glyph: "↗", color: "from-blue-500 to-indigo-700" },
    button: { glyph: "↗", color: "from-blue-500 to-indigo-700" },
    image: { glyph: "▧", color: "from-fuchsia-500 to-purple-700" },
    embed: { glyph: "▣", color: "from-sky-500 to-cyan-700" },
    weather: { glyph: "☀", color: "from-amber-400 to-orange-600" },
    "home-assistant": { glyph: "◉", color: "from-cyan-500 to-blue-700" },
    "home-assistant-light": { glyph: "💡", color: "from-yellow-400 to-amber-600" },
    "home-assistant-fan": { glyph: "✽", color: "from-teal-400 to-cyan-700" },
    "home-assistant-thermostat": { glyph: "◉", color: "from-rose-500 to-orange-600" },
    "home-assistant-dashboard": { glyph: "⌂", color: "from-sky-500 to-blue-700" },
    clock: { glyph: "◷", color: "from-indigo-500 to-violet-700" },
    calendar: { glyph: "▦", color: "from-cyan-500 to-blue-700" },
  };
  const icon = icons[card.type];

  const startPositionDrag = (event: PointerEvent<HTMLElement>) => {
    if ((!isEditMode && !isPersistentDashboardWidget(card)) || event.button !== 0) return;
    suppressClick.current = false;
    const canvas = event.currentTarget.closest<HTMLElement>("[data-dashboard-canvas]");
    const object = event.currentTarget.closest<HTMLElement>("[data-dashboard-object]");
    if (!canvas || !object) return;
    const canvasBounds = canvas.getBoundingClientRect();
    const objectBounds = object.getBoundingClientRect();
    const renderedX =
      ((objectBounds.left - canvasBounds.left) / canvasBounds.width) * 100;
    const renderedWidth =
      (objectBounds.width / canvasBounds.width) * 100;
    start.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      canvasWidth: canvasBounds.width,
      canvasHeight: canvasBounds.height,
      objectWidth: objectBounds.width,
      objectHeight: objectBounds.height,
      maxX: isPersistentDashboardWidget(card)
        ? 100 - Math.max(card.floatWidth, renderedWidth)
        : 100 - Math.min(100, renderedWidth),
      x: renderedX,
      y: card.floatY,
      nextX: renderedX,
      nextY: card.floatY,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const updatePosition = (event: PointerEvent<HTMLElement>) => {
    if (!start.current) return;
    const deltaX = event.clientX - start.current.pointerX;
    const deltaY = event.clientY - start.current.pointerY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 4) start.current.moved = true;
    if (!start.current.moved) return;
    setIsDragging(true);
    const x = Math.max(
      0,
      Math.min(
        start.current.maxX,
        start.current.x + (deltaX / start.current.canvasWidth) * 100,
      ),
    );
    const y = Math.max(
      0,
      Math.min(start.current.canvasHeight - start.current.objectHeight, start.current.y + deltaY),
    );
    start.current.nextX = x;
    start.current.nextY = y;
    onPreview(x, y);
  };

  const endPositionDrag = (event: PointerEvent<HTMLElement>) => {
    if (!start.current) return;
    if (start.current.moved) {
      suppressClick.current = true;
      onMove(start.current.nextX, start.current.nextY);
    }
    start.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const cancelPositionDrag = () => {
    if (start.current?.moved) onMove(start.current.nextX, start.current.nextY);
    start.current = null;
    setIsDragging(false);
  };

  const startWidgetResize = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const canvas = event.currentTarget.closest<HTMLElement>("[data-dashboard-canvas]");
    const object = event.currentTarget.closest<HTMLElement>("[data-dashboard-object]");
    if (!canvas || !object) return;
    event.stopPropagation();
    const canvasBounds = canvas.getBoundingClientRect();
    const bounds = object.getBoundingClientRect();
    const renderedX =
      ((bounds.left - canvasBounds.left) / canvasBounds.width) * 100;
    resizeStart.current = {
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      canvasWidth: canvasBounds.width,
      nextX: Math.min(renderedX, 80),
      width: bounds.width,
      height: bounds.height,
      nextWidth: card.floatWidth,
      nextHeight: card.floatHeight,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const updateWidgetResize = (event: PointerEvent<HTMLButtonElement>) => {
    const initial = resizeStart.current;
    if (!initial || initial.pointerId !== event.pointerId) return;
    const canvas = event.currentTarget.closest<HTMLElement>("[data-dashboard-canvas]");
    if (!canvas) return;
    const nextX = initial.nextX;
    const maxWidth = 100 - nextX;
    const width = Math.max(
      Math.min(20, maxWidth),
      Math.min(
        maxWidth,
        ((initial.width + event.clientX - initial.pointerX) /
          initial.canvasWidth) *
          100,
      ),
    );
    const height = Math.max(
      120,
      Math.min(
        2000,
        initial.height + event.clientY - initial.pointerY,
      ),
    );
    initial.nextWidth = width;
    initial.nextHeight = Math.round(height);
    initial.nextX = nextX;
    setIsDragging(true);
    onPreview(nextX, card.floatY, width, initial.nextHeight);
  };

  const finishWidgetResize = (event: PointerEvent<HTMLButtonElement>) => {
    const initial = resizeStart.current;
    if (!initial || initial.pointerId !== event.pointerId) return;
    onMove(initial.nextX, card.floatY, initial.nextWidth, initial.nextHeight);
    resizeStart.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const cancelWidgetResize = () => {
    if (!resizeStart.current) return;
    onPreview(card.floatX, card.floatY, card.floatWidth, card.floatHeight);
    resizeStart.current = null;
    setIsDragging(false);
  };

  const dragHandlers = {
    onPointerDown: startPositionDrag,
    onPointerMove: updatePosition,
    onPointerUp: endPositionDrag,
    onLostPointerCapture: cancelPositionDrag,
    onPointerCancel: cancelPositionDrag,
    onContextMenu: (event: React.MouseEvent<HTMLElement>) => {
      if (isEditMode) event.preventDefault();
    },
    style: { touchAction: isEditMode ? "none" as const : "auto" as const },
  };

  if (isPersistentDashboardWidget(card) && !isCollapsed) {
    const width = card.floatWidth === 10
      ? "min(24rem, calc(100vw - 2rem))"
      : `min(${card.floatWidth}%, calc(100vw - 2rem))`;
    return (
      <div
        className={`absolute z-10 w-[min(24rem,calc(100vw-2rem))] ${
          isDragging ? "z-20" : ""
        }`}
        data-dashboard-object
        style={{
          left: `min(${card.floatX}%, calc(100% - ${width}))`,
          top: `${card.floatY}px`,
          width,
          ...(card.floatHeight !== 320 ? { height: `${card.floatHeight}px` } : {}),
        }}
      >
        <section className="flex h-full flex-col overflow-hidden rounded-xl border border-white/35 bg-white/25 shadow-lg shadow-black/10 backdrop-blur-2xl dark:border-white/15 dark:bg-slate-950/35">
          <header
            className="group flex cursor-move items-center gap-2 border-b border-white/25 bg-white/10 px-3 py-2 backdrop-blur-lg dark:border-white/10 dark:bg-black/10"
            {...dragHandlers}
            style={{ touchAction: "none" }}
          >
            <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
              {card.title || "Untitled"}
            </h2>
            {isEditMode && (
              <>
                <button
                  aria-label={`Edit ${card.title}`}
                  className="text-xs text-indigo-700 hover:underline dark:text-indigo-300"
                  onClick={onEdit}
                  onPointerDown={(event) => event.stopPropagation()}
                  type="button"
                >
                  Edit
                </button>
                <button
                  aria-label={`Delete ${card.title}`}
                  className="text-xs text-red-700 hover:underline dark:text-red-300"
                  onClick={onDelete}
                  onPointerDown={(event) => event.stopPropagation()}
                  type="button"
                >
                  Delete
                </button>
              </>
            )}
            <button
              aria-label={`Collapse ${card.title}`}
              className="rounded px-2 py-1 text-lg leading-none text-zinc-500 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:hover:bg-white/10"
              onClick={onToggleCollapsed}
              onPointerDown={(event) => event.stopPropagation()}
              type="button"
            >
              −
            </button>
            <button
              aria-label={`Move ${card.title}`}
              className="cursor-move rounded px-2 py-1 text-lg leading-none text-zinc-500 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:hover:bg-white/10"
              onPointerDown={(event) => {
                event.stopPropagation();
                startPositionDrag(event);
              }}
              onPointerMove={updatePosition}
              onPointerUp={endPositionDrag}
              onLostPointerCapture={cancelPositionDrag}
              onPointerCancel={cancelPositionDrag}
              onKeyDown={(event) => {
                const step = event.shiftKey ? 10 : 2;
                if (event.key === "ArrowLeft") onMove(Math.max(0, card.floatX - step), card.floatY);
                else if (event.key === "ArrowRight") onMove(Math.min(100, card.floatX + step), card.floatY);
                else if (event.key === "ArrowUp") onMove(card.floatX, Math.max(0, card.floatY - step * 10));
                else if (event.key === "ArrowDown") onMove(card.floatX, card.floatY + step * 10);
                else return;
                event.preventDefault();
              }}
              style={{ touchAction: "none" }}
              type="button"
            >
              ⠿
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-auto bg-white/5 p-4 dark:bg-black/5">
            <DashboardCardContent card={card} homeAssistantBaseUrl={homeAssistantBaseUrl} />
          </div>
        </section>
        <button
          aria-label={`Resize ${card.title}`}
          className="absolute bottom-1 right-1 z-30 flex h-7 w-7 touch-none cursor-nwse-resize items-center justify-center rounded-md border border-white/40 bg-white/25 text-sm leading-none text-zinc-700 shadow backdrop-blur-md hover:bg-white/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-white"
          onPointerDown={startWidgetResize}
          onPointerMove={updateWidgetResize}
          onPointerUp={finishWidgetResize}
          onLostPointerCapture={cancelWidgetResize}
          onPointerCancel={cancelWidgetResize}
          onKeyDown={(event) => {
            const step = event.shiftKey ? 100 : 20;
            const object = event.currentTarget.closest<HTMLElement>("[data-dashboard-object]");
            const canvas = event.currentTarget.closest<HTMLElement>("[data-dashboard-canvas]");
            const bounds = object?.getBoundingClientRect();
            const canvasWidth = canvas?.getBoundingClientRect().width;
            const currentWidth =
              bounds && canvasWidth
                ? (bounds.width / canvasWidth) * 100
                : card.floatWidth;
            const currentHeight = bounds?.height ?? card.floatHeight;
            const resizedX = Math.min(card.floatX, 80);
            const availableWidth = 100 - resizedX;
            const boundedWidth = Math.min(currentWidth, availableWidth);
            if (event.key === "ArrowRight") {
              onMove(
                resizedX,
                card.floatY,
                Math.min(availableWidth, boundedWidth + (step / (canvasWidth ?? window.innerWidth)) * 100),
                currentHeight,
              );
            } else if (event.key === "ArrowLeft") {
              onMove(
                resizedX,
                card.floatY,
                Math.max(Math.min(20, availableWidth), boundedWidth - (step / (canvasWidth ?? window.innerWidth)) * 100),
                currentHeight,
              );
            } else if (event.key === "ArrowDown") {
              onMove(resizedX, card.floatY, boundedWidth, Math.min(2000, currentHeight + step));
            } else if (event.key === "ArrowUp") {
              onMove(resizedX, card.floatY, boundedWidth, Math.max(120, currentHeight - step));
            } else {
              return;
            }
            event.preventDefault();
          }}
          type="button"
        >
          ◢
        </button>
      </div>
    );
  }

  return (
    <div
      className={`absolute flex w-28 flex-col items-center ${isDragging ? "z-20" : "z-10"}`}
      data-dashboard-object
      style={{ left: `${card.floatX}%`, top: `${card.floatY}px` }}
    >
      <button
        aria-label={
          isCollapsed ? `Restore ${card.title} widget` : `Open ${card.title}`
        }
        className="group flex w-full flex-col items-center rounded-xl p-2 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
        onClick={() => {
          if (isCollapsed) {
            onToggleCollapsed();
            return;
          }
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          if (!isEditMode) onOpen();
        }}
        {...dragHandlers}
        type="button"
      >
        <DesktopObjectIcon
          card={card}
          fallbackColor={icon.color}
          fallbackGlyph={icon.glyph}
          homeAssistantBaseUrl={homeAssistantBaseUrl}
        />
        <span className="mt-2 max-w-full truncate rounded-lg border border-white/30 bg-white/20 px-2 py-0.5 text-xs font-medium text-zinc-900 shadow-sm backdrop-blur-xl dark:border-white/15 dark:bg-slate-950/30 dark:text-white">
          {isCollapsed ? `Restore ${card.title || "Untitled"}` : card.title || "Untitled"}
        </span>
      </button>
      {isEditMode && (
        <div className="mt-1 flex gap-2 rounded-md border border-white/30 bg-white/20 px-2 py-1 shadow backdrop-blur-xl dark:border-white/15 dark:bg-slate-950/30">
          <button
            className="text-xs text-indigo-700 hover:underline dark:text-indigo-300"
            onClick={onEdit}
            onPointerDown={(event) => event.stopPropagation()}
            type="button"
          >
            Edit
          </button>
          <button
            className="text-xs text-red-700 hover:underline dark:text-red-300"
            onClick={onDelete}
            onPointerDown={(event) => event.stopPropagation()}
            type="button"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function DesktopObjectModal({
  card,
  homeAssistantBaseUrl,
  onClose,
  onOpenAsDashboard,
}: {
  card: DashboardCard;
  homeAssistantBaseUrl: string;
  onClose: () => void;
  onOpenAsDashboard: () => Promise<void>;
}) {
  const [dashboardError, setDashboardError] = useState("");
  const [creatingDashboard, setCreatingDashboard] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const embeddedUrl =
    card.type === "embed"
      ? card.config.url
      : card.type === "home-assistant-dashboard"
        ? new URL(card.config.path || "/lovelace/0", `${homeAssistantBaseUrl}/`).toString()
        : null;
  const isIframeModal = embeddedUrl !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-0 backdrop-blur-sm"
      onClick={onClose}
    >
      <section
        aria-label={card.title}
        aria-modal="true"
        className={`dashboard-object-modal flex flex-col overflow-hidden border border-white/20 bg-white shadow-2xl dark:bg-zinc-900 ${
          isIframeModal
            ? "h-[95vh] w-[95vw] rounded-xl"
            : "max-h-[94vh] w-[calc(100%-1.5rem)] max-w-6xl rounded-2xl"
        }`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-200 px-4 py-3 dark:border-zinc-700 sm:px-6">
          <h2 className="truncate text-lg font-semibold">{card.title}</h2>
          <div className="flex shrink-0 items-center gap-2">
            {embeddedUrl && (
              <>
                <a
                  className="rounded-lg px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-zinc-800"
                  href={embeddedUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Open in new tab
                </a>
                <button
                  className="rounded-lg px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:text-indigo-300 dark:hover:bg-zinc-800"
                  disabled={creatingDashboard}
                  onClick={() => {
                    setCreatingDashboard(true);
                    setDashboardError("");
                    void onOpenAsDashboard()
                      .catch((error: unknown) =>
                        setDashboardError(
                          error instanceof Error
                            ? error.message
                            : "Unable to open this iframe as a dashboard.",
                        ),
                      )
                      .finally(() => setCreatingDashboard(false));
                  }}
                  type="button"
                >
                  {creatingDashboard ? "Opening…" : "Open as dashboard"}
                </button>
              </>
            )}
            <button
              aria-label="Close"
              autoFocus
              className="rounded-lg px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          </div>
        </header>
        {dashboardError && (
          <p className="shrink-0 bg-red-100 px-4 py-2 text-sm text-red-700" role="alert">
            {dashboardError}
          </p>
        )}
        <div
          className={`min-h-0 flex-1 ${
            isIframeModal ? "overflow-hidden" : "overflow-auto p-4 sm:p-6"
          }`}
        >
          <DashboardCardContent card={card} homeAssistantBaseUrl={homeAssistantBaseUrl} />
        </div>
      </section>
    </div>
  );
}
export default function DashboardClient({ user }: { user: AuthUser }) {
  const router = useRouter();
  const [themeConfig, setThemeConfig] = useState(defaultThemeConfig);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [activeDashboardId, setActiveDashboardId] = useState<string | null>(null);
  const [collapsedWidgetIds, setCollapsedWidgetIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [pageError, setPageError] = useState("");
  const theme = themeConfig.mode ?? "light";
  const [isEditMode, setIsEditMode] = useState(false);
  const [editor, setEditor] = useState<CardDraft | null>(null);
  const [addContentSectionId, setAddContentSectionId] = useState<string | null>(null);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const saveThemeConfig = async (config: ThemeConfig) => {
    const savedConfig = await persistThemeSettings(config);
    setThemeConfig(savedConfig);
    setNotice("Desktop theme applied.");
  };

  const toggleThemeMode = async () => {
    try {
      await saveThemeConfig({
        ...themeConfig,
        mode: theme === "light" ? "dark" : "light",
      });
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Unable to save your theme mode.",
      );
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const loadTheme = async () => {
      try {
        const response = await fetch("/api/user-settings/theme", {
          signal: controller.signal,
        });
        const result: unknown = await response.json();
        if (!response.ok || typeof result !== "object" || result === null || !("theme" in result)) {
          throw new Error(errorMessage(result, "Unable to load your theme settings."));
        }
        if (result.theme !== null) {
          const savedTheme = parseThemeConfig(result.theme);
          if (!savedTheme) throw new Error("The server returned invalid theme settings.");
          setThemeConfig(savedTheme);
          setThemeLoaded(true);
          return;
        }

        const legacyValue = window.localStorage.getItem(`lander-theme:${user.id}`);
        if (!legacyValue) {
          setThemeLoaded(true);
          return;
        }
        let legacy: unknown;
        try {
          legacy = JSON.parse(legacyValue);
        } catch (error) {
          throw new Error("Your existing browser theme settings are invalid.", {
            cause: error,
          });
        }
        if (typeof legacy !== "object" || legacy === null || !("backgroundImage" in legacy) || typeof legacy.backgroundImage !== "string") {
          throw new Error("Your existing browser theme settings are invalid.");
        }
        const legacyWallpaperId = wallpaperIdFromBackground(legacy.backgroundImage);
        const legacyBase = parseThemeConfig(
          legacyWallpaperId
            ? { ...legacy, backgroundImage: "none" }
            : legacy,
        );
        if (!legacyBase) throw new Error("Your existing browser theme settings are invalid.");
        let migratedTheme = legacyBase;
        if (legacyWallpaperId) {
          const wallpaper = await loadThemeWallpaper(`${user.id}:${legacyWallpaperId}`);
          if (!wallpaper) {
            throw new Error("The saved browser wallpaper is missing and could not be migrated.");
          }
          migratedTheme = {
            ...legacyBase,
            backgroundImage: `url("${await blobToDataUrl(wallpaper)}")`,
          };
        }
        const savedTheme = await persistThemeSettings(migratedTheme);
        window.localStorage.removeItem(`lander-theme:${user.id}`);
        setThemeConfig(savedTheme);
        setThemeLoaded(true);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setThemeLoaded(true);
          setPageError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load your theme settings.",
          );
        }
      }
    };
    void loadTheme();
    return () => controller.abort();
  }, [user.id]);

  const loadDashboard = useCallback(async () => {
    setPageError("");
    try {
      const response = await fetch("/api/dashboard");
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(errorMessage(result, "Unable to load dashboard."));
      setDashboard(result as DashboardData);
    } catch (loadError) {
      setPageError(loadError instanceof Error ? loadError.message : "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/dashboard", { signal: controller.signal })
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok) throw new Error(errorMessage(result, "Unable to load dashboard."));
        return result as DashboardData;
      })
      .then((result) => {
        setDashboard(result);
        setPageError("");
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setPageError(
            loadError instanceof Error ? loadError.message : "Unable to load dashboard.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [loadDashboard]);

  useEffect(() => {
    const timeoutMs = 60_000;
    let lastActivity = Date.now();
    let timeout: number;
    const goToLandingPage = () => router.replace("/");
    const resetInactivityTimer = () => {
      lastActivity = Date.now();
      window.clearTimeout(timeout);
      timeout = window.setTimeout(goToLandingPage, timeoutMs);
    };
    const checkInactivity = () => {
      const remaining = timeoutMs - (Date.now() - lastActivity);
      if (remaining <= 0) {
        goToLandingPage();
      } else {
        window.clearTimeout(timeout);
        timeout = window.setTimeout(goToLandingPage, remaining);
      }
    };
    const activityEvents = ["pointerdown", "pointermove", "keydown", "touchstart", "wheel"];
    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, resetInactivityTimer, { passive: true }),
    );
    document.addEventListener("visibilitychange", checkInactivity);
    timeout = window.setTimeout(goToLandingPage, timeoutMs);
    return () => {
      window.clearTimeout(timeout);
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, resetInactivityTimer),
      );
      document.removeEventListener("visibilitychange", checkInactivity);
    };
  }, [router]);

  const selectDashboard = (id: string) => {
    setActiveDashboardId(id);
    setSelectedObjectId(null);
    setEditor(null);
    setAddContentSectionId(null);
  };

  const closeDashboard = async (item: DashboardPage) => {
    if (!dashboard || dashboard.dashboards.length <= 1) return;
    if (
      !window.confirm(
        `Close “${item.title}”? Its dashboard objects and layout will be permanently deleted.`,
      )
    ) {
      return;
    }
    setPageError("");
    try {
      const response = await fetch(
        `/api/dashboard/dashboards/${encodeURIComponent(item.id)}`,
        { method: "DELETE" },
      );
      const result: { data?: DashboardData; error?: string } = await response.json();
      if (!response.ok || !result.data) {
        throw new Error(result.error ?? "Unable to close dashboard.");
      }
      setDashboard(result.data);
      if (activeDashboardId === item.id) {
        const nextDashboard = result.data.dashboards.find(
          (candidate) => candidate.position >= item.position,
        ) ?? result.data.dashboards[result.data.dashboards.length - 1];
        selectDashboard(nextDashboard.id);
      }
      setNotice(`Dashboard “${item.title}” closed.`);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to close dashboard.");
    }
  };

  const addDashboard = async (
    input: { title: string; kind: "desktop" | "iframe"; iframeUrl?: string },
  ) => {
    const response = await fetch("/api/dashboard/dashboards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const result: {
      dashboard?: DashboardPage;
      data?: DashboardData;
      error?: string;
    } = await response.json();
    if (!response.ok || !result.dashboard || !result.data) {
      throw new Error(result.error ?? "Unable to create dashboard.");
    }
    setDashboard(result.data);
    selectDashboard(result.dashboard.id);
    setNotice(`Dashboard “${result.dashboard.title}” added.`);
  };

  const saveCard = async (draft: CardDraft, showNotice = true) => {
    const response = await fetch(
      draft.id
        ? `/api/dashboard/cards/${encodeURIComponent(draft.id)}`
        : "/api/dashboard/cards",
      {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId: draft.sectionId,
          type: draft.type,
          title: draft.title,
          config: draft.config,
          colSpan: draft.colSpan,
          rowSpan: draft.rowSpan,
          floatX: draft.floatX,
          floatY: draft.floatY,
          floatWidth: draft.floatWidth,
          floatHeight: draft.floatHeight,
        }),
      },
    );
    const result: unknown = await response.json();
    if (!response.ok) throw new Error(errorMessage(result, "Unable to save card."));
    if (showNotice) setNotice(draft.id ? "Object updated." : "Object added.");
    await loadDashboard();
  };

  const saveCardFromEditor = async (draft: CardDraft) => {
    await saveCard(draft);
    setEditor(null);
  };

  const openCardAsDashboard = async (card: DashboardCard) => {
    const iframeUrl =
      card.type === "embed"
        ? card.config.url
        : card.type === "home-assistant-dashboard"
          ? new URL(
              card.config.path || "/lovelace/0",
              `${dashboard?.homeAssistantBaseUrl}/`,
            ).toString()
          : null;
    if (!iframeUrl) throw new Error("Only iframe objects can open as dashboards.");
    await addDashboard({ title: card.title, kind: "iframe", iframeUrl });
  };

  const deleteCard = async (card: DashboardCard) => {
    if (!window.confirm(`Delete the “${card.title}” object?`)) return;
    try {
      const response = await fetch(`/api/dashboard/cards/${encodeURIComponent(card.id)}`, {
        method: "DELETE",
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        setPageError(errorMessage(result, "Unable to delete card."));
        return;
      }
      setNotice("Object deleted.");
      await loadDashboard();
    } catch {
      setPageError("Unable to reach the server. The object was not deleted.");
    }
  };

  const previewFloatingCard = (
    cardId: string,
    floatX: number,
    floatY: number,
    floatWidth?: number,
    floatHeight?: number,
  ) => {
    setDashboard((current) =>
      current
        ? {
            ...current,
            cards: current.cards.map((card) =>
              card.id === cardId
                ? {
                    ...card,
                    floatX,
                    floatY,
                    ...(floatWidth === undefined ? {} : { floatWidth }),
                    ...(floatHeight === undefined ? {} : { floatHeight }),
                  }
                : card,
            ),
          }
        : current,
    );
  };

  const persistObjectPosition = async (
    card: DashboardCard,
    floatX: number,
    floatY: number,
    floatWidth = card.floatWidth,
    floatHeight = card.floatHeight,
  ) => {
    try {
      await saveCard({ ...card, floatX, floatY, floatWidth, floatHeight }, false);
    } catch (error) {
      await loadDashboard();
      setPageError(error instanceof Error ? error.message : "Unable to save object position.");
    }
  };

  const chooseCardType = (type: DashboardCardType) => {
    if (!dashboard || !addContentSectionId) return;
    const config: Record<string, string> = {};
    if (type === "markdown") config.markdown = "";
    if (type === "link" || type === "button") {
      config.url = "";
      if (type === "button") config.label = "Open";
      else config.description = "";
    }
    if (type === "image") {
      config.url = "";
      config.alt = "";
    }
    if (type === "embed") config.url = "";
    if (type === "weather") {
      config.provider = dashboard.homeAssistantConfigured
        ? "home-assistant"
        : "open-meteo";
      if (dashboard.homeAssistantConfigured) config.entityId = "";
      else config.location = "";
      config.units = "imperial";
      config.forecastType = "daily";
    }
    if (
      type === "home-assistant" ||
      type === "home-assistant-light" ||
      type === "home-assistant-fan" ||
      type === "home-assistant-thermostat"
    ) {
      config.entityId = "";
    }
    if (type === "home-assistant-dashboard") config.path = "/lovelace/0";

    setAddContentSectionId(null);
    setEditor({
      type,
      title: "",
      sectionId: addContentSectionId,
      config,
      colSpan: 1,
      rowSpan: 1,
      floatX: 3 + (activeCards.length % 6) * 15,
      floatY: 8 + Math.floor(activeCards.length / 6) * 120,
      floatWidth: 10,
      floatHeight: 320,
    });
  };

  const handleAddDashboard = async () => {
    const title = window.prompt("Name your new dashboard:", "New dashboard")?.trim();
    if (!title) return;
    if (title.length > 80) {
      setPageError("Dashboard names must be 80 characters or fewer.");
      return;
    }
    setPageError("");
    try {
      await addDashboard({ title, kind: "desktop" });
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to create dashboard.");
    }
  };

  const handleLogout = async () => {
    setPageError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign out failed.");
      router.replace("/");
    } catch {
      setPageError("Unable to sign out right now. Please try again.");
    }
  };

  if (loading || !themeLoaded) {
    return <main className="min-h-screen bg-zinc-100 p-8 text-zinc-700">Loading dashboard…</main>;
  }
  if (!dashboard) {
    return (
      <main className="min-h-screen bg-zinc-100 p-8 text-zinc-900">
        <p role="alert">{pageError || "Unable to load dashboard."}</p>
        <button className="mt-4 text-indigo-600 underline" onClick={() => void loadDashboard()} type="button">
          Try again
        </button>
      </main>
    );
  }

  const activeDashboard =
    dashboard.dashboards.find((item) => item.id === activeDashboardId) ??
    dashboard.dashboards[0];
  const activeSectionIds = new Set(
    dashboard.sections
      .filter((section) => section.dashboardId === activeDashboard.id)
      .map((section) => section.id),
  );
  const activeCards = dashboard.cards.filter((card) => activeSectionIds.has(card.sectionId));
  const canvasHeight = Math.max(
    560,
    ...activeCards.map(
      (card) =>
        card.floatY +
        (isPersistentDashboardWidget(card)
          ? Math.max(720, card.floatHeight)
          : 160),
    ),
  );
  const selectedObject = activeCards.find((card) => card.id === selectedObjectId) ?? null;

  return (
    <main
      className={`${activeDashboard.kind === "iframe" ? "h-dvh overflow-hidden pb-0" : "min-h-dvh"} flex flex-col px-2 py-2 text-zinc-900 dark:text-white sm:px-3 md:px-4 md:py-3 ${theme === "dark" ? "bg-black" : "bg-zinc-50"}`}
      style={{
        backgroundColor: themeConfig.bgColor,
        backgroundImage:
          themeConfig.backgroundImage === "none"
            ? undefined
            : themeConfig.backgroundImage,
        backgroundPosition: "center",
        backgroundSize: "cover",
      }}
    >
      <header className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-zinc-200/80 bg-white/70 px-3 py-2 shadow-sm backdrop-blur-md dark:border-zinc-700/80 dark:bg-zinc-950/75">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="shrink-0 text-xl font-black tracking-tight sm:text-2xl" style={{ color: themeConfig.primaryColor }}>
            Evil-Lander
          </h1>
          <span className="hidden h-6 w-px bg-zinc-300 dark:bg-zinc-700 sm:block" />
          <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
            <span className="max-w-[10rem] truncate sm:max-w-none">{user.email}</span>
            {user.role === "admin" && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                Admin
              </span>
            )}
          </div>
        </div>
        {dashboard.dashboards.length > 1 && (
          <nav
            aria-label="Dashboards"
            className="order-3 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-1 sm:order-none sm:justify-center"
          >
            {dashboard.dashboards.map((item) => (
              <div
                className={`flex shrink-0 items-center rounded-full border transition ${
                  activeDashboard.id === item.id
                    ? "border-indigo-500 bg-transparent text-indigo-700 dark:text-indigo-200"
                    : "border-zinc-300 bg-transparent text-zinc-600 hover:border-indigo-400 hover:text-indigo-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-indigo-600 dark:hover:text-indigo-200"
                }`}
                key={item.id}
              >
                <button
                  aria-current={activeDashboard.id === item.id ? "page" : undefined}
                  className="py-1.5 pl-3.5 pr-1.5 text-xs font-semibold"
                  onClick={() => selectDashboard(item.id)}
                  type="button"
                >
                  {item.title}
                </button>
                <button
                  aria-label={`Close ${item.title} dashboard`}
                  className={`mr-1 rounded-full p-1 text-sm leading-none transition ${
                    activeDashboard.id === item.id
                      ? "text-indigo-500 hover:text-red-600 dark:text-indigo-300 dark:hover:text-red-300"
                      : "text-zinc-400 hover:text-red-700 dark:hover:text-red-300"
                  }`}
                  onClick={() => void closeDashboard(item)}
                  title={`Close ${item.title}`}
                  type="button"
                >
                  ×
                </button>
              </div>
            ))}
          </nav>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            className="rounded-lg border border-indigo-400/70 bg-transparent px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition hover:border-indigo-600 hover:text-indigo-900 dark:border-indigo-500/50 dark:text-indigo-200 dark:hover:border-indigo-300 dark:hover:text-white"
            onClick={() => void handleAddDashboard()}
            type="button"
          >
            + Add dashboard
          </button>
          {isEditMode && (
            <>
              <button
                className="rounded-lg border border-indigo-600 bg-transparent px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition hover:border-indigo-800 hover:text-indigo-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-400 dark:text-indigo-200 dark:hover:border-indigo-200 dark:hover:text-white"
                disabled={activeDashboard.kind !== "desktop" || !dashboard.sections.some((section) => section.dashboardId === activeDashboard.id)}
                onClick={() =>
                  setAddContentSectionId(
                    dashboard.sections.find((section) => section.dashboardId === activeDashboard.id)?.id ?? null,
                  )
                }
                type="button"
              >
                + Add object
              </button>
              {user.role === "admin" && (
                <button className="rounded-lg border border-zinc-300 bg-transparent px-2.5 py-1.5 text-xs font-medium transition hover:border-zinc-500 dark:border-zinc-600 dark:hover:border-zinc-400" onClick={() => setIsSettingsOpen(true)} type="button">
                  Home Assistant settings
                </button>
              )}
              <button className="rounded-lg border border-zinc-300 bg-transparent px-2.5 py-1.5 text-xs font-medium transition hover:border-zinc-500 dark:border-zinc-600 dark:hover:border-zinc-400" onClick={() => setIsThemeOpen(true)} type="button">
                Themes
              </button>
            </>
          )}
          <button
            aria-pressed={isEditMode}
            className={`rounded-lg border bg-transparent px-2.5 py-1.5 text-xs font-semibold transition ${isEditMode ? "border-emerald-600 text-emerald-700 hover:border-emerald-800 hover:text-emerald-900 dark:border-emerald-400 dark:text-emerald-300" : "border-zinc-300 hover:border-zinc-500 dark:border-zinc-600 dark:hover:border-zinc-400"}`}
            onClick={() => {
              setIsEditMode((current) => !current);
              setEditor(null);
              setAddContentSectionId(null);
              setSelectedObjectId(null);
            }}
            type="button"
          >
            {isEditMode ? "Done" : "Edit dashboard"}
          </button>
          <button className="rounded-lg border border-zinc-300 bg-transparent px-2.5 py-1.5 text-xs font-medium transition hover:border-zinc-500 dark:border-zinc-600 dark:hover:border-zinc-400" onClick={() => void toggleThemeMode()} type="button">
            {theme === "light" ? "Dark" : "Light"} mode
          </button>
          <button
            className="rounded-lg border border-fuchsia-300/70 bg-transparent px-2.5 py-1.5 text-xs font-semibold text-fuchsia-700 transition hover:border-fuchsia-500 hover:text-fuchsia-900 dark:text-fuchsia-200 dark:hover:border-fuchsia-300 dark:hover:text-white"
            onClick={() => router.push("/")}
            type="button"
          >
            Landing page
          </button>
          {user.role === "admin" && (
            <button
              className="rounded-lg border border-indigo-400/70 bg-transparent px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition hover:border-indigo-600 dark:text-indigo-200 dark:hover:border-indigo-300 dark:hover:text-white"
              onClick={() => router.push("/?editLanding=1")}
              type="button"
            >
              Edit landing page
            </button>
          )}
          <button className="rounded-lg border border-zinc-300 bg-transparent px-2.5 py-1.5 text-xs font-medium transition hover:border-red-500 hover:text-red-700 dark:border-zinc-600 dark:hover:border-red-400 dark:hover:text-red-300" onClick={() => void handleLogout()} type="button">
            Log out
          </button>
        </div>
      </header>

      {isEditMode && (
        <p className="mb-2 px-1 text-xs text-zinc-600 dark:text-zinc-400" role="status">
          Drag objects to arrange your desktop. Select an object to open it; use Edit or Delete beneath it to manage it.
        </p>
      )}
      {pageError && <p className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300" role="alert">{pageError}</p>}
      {notice && <p className="fixed bottom-4 right-4 z-40 max-w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-emerald-300/60 bg-zinc-950/90 px-4 py-2.5 text-xs font-medium text-emerald-200 shadow-xl backdrop-blur" role="status">{notice}</p>}

      {activeDashboard.kind === "iframe" && activeDashboard.iframeUrl ? (
        <section aria-label={activeDashboard.title} className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-300 bg-white shadow dark:border-zinc-700">
          <div className="relative min-h-0 flex-1">
            <WebsiteEmbed title={activeDashboard.title} url={activeDashboard.iframeUrl} />
          </div>
        </section>
      ) : (
        <div
          className={`relative overflow-hidden rounded-2xl border border-zinc-300/70 bg-white/40 shadow-inner dark:border-zinc-700 dark:bg-zinc-900/30 ${isEditMode ? "ring-2 ring-indigo-400/50" : ""}`}
          data-dashboard-canvas
          style={{
            minHeight: `max(${canvasHeight}px, calc(100dvh - 11rem))`,
            backgroundColor: themeConfig.bgColor,
            backgroundImage:
              themeConfig.backgroundImage === "none"
                ? "radial-gradient(circle, rgba(148,163,184,.18) 1px, transparent 1px)"
                : `radial-gradient(circle, rgba(148,163,184,.18) 1px, transparent 1px), ${themeConfig.backgroundImage}`,
            backgroundPosition: "center, center",
            backgroundSize: "22px 22px, cover",
          }}
        >
          {activeCards.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-zinc-500">
              {isEditMode ? "Add an object to start building your desktop." : "Your desktop is empty. Choose Edit dashboard to add objects."}
            </div>
          )}
          {activeCards.map((card) => (
            <DesktopObject
              card={card}
              isCollapsed={collapsedWidgetIds.has(card.id)}
              homeAssistantBaseUrl={dashboard.homeAssistantBaseUrl}
              isEditMode={isEditMode}
              key={card.id}
              onDelete={() => void deleteCard(card)}
              onEdit={() => setEditor(card)}
              onToggleCollapsed={() =>
                setCollapsedWidgetIds((current) => {
                  const next = new Set(current);
                  if (next.has(card.id)) next.delete(card.id);
                  else next.add(card.id);
                  return next;
                })
              }
              onMove={(x, y, width, height) =>
                void persistObjectPosition(card, x, y, width, height)
              }
              onOpen={() => setSelectedObjectId(card.id)}
              onPreview={(x, y, width, height) =>
                previewFloatingCard(card.id, x, y, width, height)
              }
            />
          ))}
        </div>
      )}

      {selectedObject && !isEditMode && (
        <DesktopObjectModal
          card={selectedObject}
          homeAssistantBaseUrl={dashboard.homeAssistantBaseUrl}
          onClose={() => setSelectedObjectId(null)}
          onOpenAsDashboard={() => openCardAsDashboard(selectedObject)}
        />
      )}

      {editor && (
        <CardEditorModal
          card={editor}
          homeAssistantConfigured={dashboard.homeAssistantConfigured}
          homeAssistantBaseUrl={dashboard.homeAssistantBaseUrl}
          onClose={() => setEditor(null)}
          onSave={saveCardFromEditor}
        />
      )}
      {addContentSectionId && (
        <AddContentMenu
          homeAssistantConfigured={dashboard.homeAssistantConfigured}
          onClose={() => setAddContentSectionId(null)}
          onSelect={chooseCardType}
        />
      )}
      {isThemeOpen && (
        <ThemeCustomizationModal
          config={themeConfig}
          onClose={() => setIsThemeOpen(false)}
          onSave={saveThemeConfig}
        />
      )}
      {isSettingsOpen && (
        <HomeAssistantSettingsModal
          onClose={() => setIsSettingsOpen(false)}
          onSaved={(baseUrl) => {
            setDashboard((current) =>
              current
                ? {
                    ...current,
                    homeAssistantConfigured: true,
                    homeAssistantBaseUrl: baseUrl,
                  }
                : current,
            );
            setNotice("Home Assistant connection saved.");
          }}
        />
      )}
    </main>
  );
}
