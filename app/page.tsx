"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  DashboardCardContent,
} from "@/app/dashboard/dashboard-client";
import type { DashboardCard } from "@/lib/dashboard-data";
import {
  defaultLandingPageSettings,
  type LandingPageSettings,
} from "@/lib/landing-page-shared";
import {
  avatarImageSource,
  isUserProfile,
  type UserProfile,
} from "@/lib/user-profile-shared";

type AuthMode = "login" | "signup";
type SessionUser = { id: string; email: string; role: "admin" | "user" } & UserProfile;
type LandingWidgetPosition = { x: number; y: number };

function defaultLandingWidgetPosition(index: number): LandingWidgetPosition {
  return {
    x: 12 + (index % 4) * 25,
    y: Math.min(94, 64 + Math.floor(index / 4) * 17),
  };
}

function LoginModal({
  onClose,
  onLoginSuccess,
}: {
  onClose: () => void;
  onLoginSuccess: () => void;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/auth/${mode === "signup" ? "signup" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result: { error?: string } = await response.json();

      if (!response.ok) {
        setError(result.error ?? "Authentication failed. Please try again.");
        return;
      }

      onLoginSuccess();
      onClose();
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSignup = mode === "signup";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby="auth-title"
        aria-modal="true"
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 shadow-2xl dark:border-zinc-700 dark:bg-gray-800"
        role="dialog"
      >
        <h2
          className="mb-6 text-center text-3xl font-bold text-zinc-900 dark:text-white"
          id="auth-title"
        >
          {isSignup ? "Create Your Account" : "Homelab Login"}
        </h2>
        {error && (
          <p className="mb-4 rounded bg-red-100/50 p-2 text-center text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              htmlFor="auth-email"
            >
              Email Address
            </label>
            <input
              autoComplete="email"
              className="w-full rounded-lg border border-zinc-300 bg-gray-50 p-3 text-zinc-900 focus:border-indigo-500 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-gray-700 dark:text-white"
              id="auth-email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              htmlFor="auth-password"
            >
              Password
            </label>
            <input
              autoComplete={isSignup ? "new-password" : "current-password"}
              className="w-full rounded-lg border border-zinc-300 bg-gray-50 p-3 text-zinc-900 focus:border-indigo-500 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-gray-700 dark:text-white"
              id="auth-password"
              maxLength={128}
              minLength={isSignup ? 12 : undefined}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            {isSignup && (
              <p className="mt-1 text-xs text-zinc-500">Use at least 12 characters.</p>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
              onClick={() => {
                setMode(isSignup ? "login" : "signup");
                setError("");
              }}
              type="button"
            >
              {isSignup ? "Already registered? Log in" : "New here? Create an account"}
            </button>
            <div className="flex gap-3">
              <button
                className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-gray-700"
                onClick={onClose}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-md transition-colors hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "Please wait…" : isSignup ? "Sign Up" : "Sign In"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [isPositioning, setIsPositioning] = useState(false);
  const [isWidgetPositioning, setIsWidgetPositioning] = useState(false);
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [settings, setSettings] = useState(defaultLandingPageSettings);
  const [draft, setDraft] = useState(defaultLandingPageSettings);
  const [landingWidgetIds, setLandingWidgetIds] = useState<string[]>([]);
  const [widgetDraftIds, setWidgetDraftIds] = useState<string[]>([]);
  const [landingWidgetPositions, setLandingWidgetPositions] = useState<
    Record<string, LandingWidgetPosition>
  >({});
  const [widgetDraftPositions, setWidgetDraftPositions] = useState<
    Record<string, LandingWidgetPosition>
  >({});
  const [availableWidgets, setAvailableWidgets] = useState<DashboardCard[]>([]);
  const [homeAssistantBaseUrl, setHomeAssistantBaseUrl] = useState("");
  const [error, setError] = useState("");
  const [settingsTab, setSettingsTab] = useState<"background" | "elements">(
    "background",
  );
  const mainRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{
    item: "logo" | "welcome" | `image:${string}` | `widget:${string}`;
    pointerId: number;
    pointerX: number;
    pointerY: number;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadSettings = async (): Promise<LandingPageSettings | null> => {
      try {
        const response = await fetch("/api/landing-page", {
          signal: controller.signal,
        });
        const result: unknown = await response.json();
        if (!response.ok) {
          throw new Error("Unable to load landing page customization.");
        }
        if (
          typeof result !== "object" ||
          result === null ||
          !("welcomeEnabled" in result) ||
          typeof result.welcomeEnabled !== "boolean" ||
          !("welcomeText" in result) ||
          typeof result.welcomeText !== "string"
        ) {
          throw new Error("The landing page returned invalid customization data.");
        }
        const config = result as LandingPageSettings;
        setSettings(config);
        setDraft(config);
        return config;
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load landing page customization.",
          );
        }
        return null;
      }
    };
    const landingSettingsPromise = loadSettings();
    const loadSession = async () => {
      try {
        const response = await fetch("/api/auth/session", {
          signal: controller.signal,
        });
        const result: unknown = await response.json();
        if (!response.ok) throw new Error("Unable to check landing page permissions.");
        if (
          typeof result !== "object" ||
          result === null ||
          !("user" in result) ||
          typeof result.user !== "object" ||
          result.user === null ||
          !("id" in result.user) ||
          typeof result.user.id !== "string" ||
          !("email" in result.user) ||
          typeof result.user.email !== "string" ||
          !("role" in result.user) ||
          (result.user.role !== "admin" && result.user.role !== "user") ||
          !("profile" in result) ||
          !isUserProfile(result.profile)
        ) {
          setSessionUser(null);
          return;
        }
        setSessionUser({
          id: result.user.id,
          email: result.user.email,
          role: result.user.role,
          ...result.profile,
        });
        if (
          result.user.role === "admin" &&
          new URLSearchParams(window.location.search).get("editLanding") === "1"
        ) {
          const config = await landingSettingsPromise;
          if (config) {
            window.history.replaceState(null, "", window.location.pathname);
            setDraft(config);
            setSettingsTab("background");
            setIsCustomizeOpen(true);
          }
        }
        const [widgetsResponse, dashboardResponse] = await Promise.all([
          fetch("/api/user-settings/landing-widgets", {
            signal: controller.signal,
          }),
          fetch("/api/dashboard", { signal: controller.signal }),
        ]);
        const [widgetsResult, dashboardResult]: [unknown, unknown] =
          await Promise.all([widgetsResponse.json(), dashboardResponse.json()]);
        if (!widgetsResponse.ok || !dashboardResponse.ok) {
          throw new Error("Unable to load your private landing page widgets.");
        }
        if (
          typeof widgetsResult !== "object" ||
          widgetsResult === null ||
          !("widgetIds" in widgetsResult) ||
          !Array.isArray(widgetsResult.widgetIds) ||
          !widgetsResult.widgetIds.every((id) => typeof id === "string") ||
          !("positions" in widgetsResult) ||
          typeof widgetsResult.positions !== "object" ||
          widgetsResult.positions === null ||
          Array.isArray(widgetsResult.positions) ||
          typeof dashboardResult !== "object" ||
          dashboardResult === null ||
          !("cards" in dashboardResult) ||
          !Array.isArray(dashboardResult.cards) ||
          !("homeAssistantBaseUrl" in dashboardResult) ||
          typeof dashboardResult.homeAssistantBaseUrl !== "string" ||
          !dashboardResult.cards.every(
            (card) =>
              typeof card === "object" &&
              card !== null &&
              "id" in card &&
              typeof card.id === "string" &&
              "type" in card &&
              typeof card.type === "string",
          )
        ) {
          throw new Error("The server returned invalid landing page widgets.");
        }
        setLandingWidgetIds(widgetsResult.widgetIds);
        setWidgetDraftIds(widgetsResult.widgetIds);
        const loadedPositions = widgetsResult.positions as Record<
          string,
          LandingWidgetPosition
        >;
        setLandingWidgetPositions(loadedPositions);
        setWidgetDraftPositions(loadedPositions);
        setAvailableWidgets(dashboardResult.cards as DashboardCard[]);
        setHomeAssistantBaseUrl(dashboardResult.homeAssistantBaseUrl);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to check landing page permissions.",
          );
        }
      }
    };
    void loadSession();
    return () => controller.abort();
  }, []);

  const saveSettings = async (nextSettings: LandingPageSettings) => {
    setError("");
    try {
      const response = await fetch("/api/landing-page", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextSettings),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Unable to save landing page settings.";
        throw new Error(message);
      }
      setSettings(nextSettings);
      setDraft(nextSettings);
      setIsCustomizeOpen(false);
      setIsPositioning(false);
      return true;
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save landing page settings.",
      );
      return false;
    }
  };

  const signOut = async () => {
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Unable to sign out right now.";
        throw new Error(message);
      }
      setSessionUser(null);
      setLandingWidgetIds([]);
      setWidgetDraftIds([]);
      setLandingWidgetPositions({});
      setWidgetDraftPositions({});
      setAvailableWidgets([]);
      setHomeAssistantBaseUrl("");
      setIsWidgetModalOpen(false);
      setIsWidgetPositioning(false);
      setIsCustomizeOpen(false);
      setIsPositioning(false);
      setDraft(settings);
      window.location.reload();
    } catch (signOutError) {
      setError(
        signOutError instanceof Error
          ? signOutError.message
          : "Unable to sign out right now.",
      );
    }
  };

  const saveLandingWidgets = async (
    widgetIds: string[],
    positions: Record<string, LandingWidgetPosition>,
  ) => {
    setError("");
    try {
      const selectedPositions = Object.fromEntries(
        widgetIds.map((id, index) => [
          id,
          positions[id] ??
            landingWidgetPositions[id] ??
            defaultLandingWidgetPosition(index),
        ]),
      );
      const response = await fetch("/api/user-settings/landing-widgets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widgetIds, positions: selectedPositions }),
      });
      const result: unknown = await response.json();
      if (
        !response.ok ||
        typeof result !== "object" ||
        result === null ||
        !("widgetIds" in result) ||
        !Array.isArray(result.widgetIds) ||
        !result.widgetIds.every((id) => typeof id === "string") ||
        !("positions" in result) ||
        typeof result.positions !== "object" ||
        result.positions === null ||
        Array.isArray(result.positions)
      ) {
        throw new Error(
          typeof result === "object" &&
            result !== null &&
            "error" in result &&
            typeof result.error === "string"
            ? result.error
            : "Unable to save your landing page widgets.",
        );
      }
      setLandingWidgetIds(result.widgetIds);
      setLandingWidgetPositions(
        result.positions as Record<string, LandingWidgetPosition>,
      );
      setWidgetDraftPositions(
        result.positions as Record<string, LandingWidgetPosition>,
      );
      setIsWidgetModalOpen(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save your landing page widgets.",
      );
    }
  };

  const startPositionDrag = (
    item: "logo" | "welcome" | `image:${string}` | `widget:${string}`,
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const element = event.currentTarget;
    const stage = mainRef.current;
    if (!stage || event.button !== 0) return;
    const widgetId = item.startsWith("widget:") ? item.slice(7) : null;
    const widgetIndex = widgetId ? widgetDraftIds.indexOf(widgetId) : -1;
    const widgetPosition =
      widgetId && widgetIndex >= 0
        ? widgetDraftPositions[widgetId] ?? defaultLandingWidgetPosition(widgetIndex)
        : null;
    const image = item.startsWith("image:")
      ? draft.images.find((candidate) => candidate.id === item.slice(6))
      : null;
    const x =
      item === "logo"
        ? draft.logoX
        : item === "welcome"
          ? draft.welcomeX
          : widgetPosition?.x ?? image?.x ?? 50;
    const y =
      item === "logo"
        ? draft.logoY
        : item === "welcome"
          ? draft.welcomeY
          : widgetPosition?.y ?? image?.y ?? 50;
    dragRef.current = {
      item,
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      x,
      y,
    };
    element.setPointerCapture(event.pointerId);
  };

  const updatePositionDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const stage = mainRef.current;
    if (!drag || !stage || drag.pointerId !== event.pointerId) return;
    const bounds = stage.getBoundingClientRect();
    const x = Math.max(
      0,
      Math.min(100, drag.x + ((event.clientX - drag.pointerX) / bounds.width) * 100),
    );
    const y = Math.max(
      0,
      Math.min(100, drag.y + ((event.clientY - drag.pointerY) / bounds.height) * 100),
    );
    if (drag.item.startsWith("widget:")) {
      const widgetId = drag.item.slice(7);
      setWidgetDraftPositions((positions) => ({
        ...positions,
        [widgetId]: { x, y },
      }));
      return;
    }
    setDraft((current) => {
      if (drag.item === "logo") return { ...current, logoX: x, logoY: y };
      if (drag.item === "welcome") return { ...current, welcomeX: x, welcomeY: y };
      const imageId = drag.item.slice(6);
      return {
        ...current,
        images: current.images.map((image) =>
          image.id === imageId ? { ...image, x, y } : image,
        ),
      };
    });
  };

  const finishPositionDrag = () => {
    dragRef.current = null;
  };

  const readImageFile = (
    file: File | undefined,
    onRead: (dataUrl: string) => void,
  ) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      setError("Choose a PNG, JPEG, WebP, or GIF image.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError("Each landing page image must be 12 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setError("The selected image could not be read.");
        return;
      }
      onRead(reader.result);
      setError("");
    };
    reader.onerror = () => setError("The selected image could not be read.");
    reader.readAsDataURL(file);
  };

  const addLandingImage = (file: File | undefined) => {
    if (draft.images.length >= 8) {
      setError("You can add up to 8 additional landing page images.");
      return;
    }
    readImageFile(file, (dataUrl) => {
      setDraft((current) => ({
        ...current,
        images: [
          ...current.images,
          { id: crypto.randomUUID(), dataUrl, x: 50, y: 50, width: 22 },
        ],
      }));
    });
  };

  const setLandingBackground = (file: File | undefined) => {
    readImageFile(file, (dataUrl) => {
      setDraft((current) => ({
        ...current,
        backgroundMode: "image",
        backgroundImageDataUrl: dataUrl,
      }));
    });
  };

  const displayedSettings = isPositioning ? draft : settings;

  return (
    <main
      className="relative min-h-svh w-full overflow-hidden bg-black"
      onPointerCancel={finishPositionDrag}
      ref={mainRef}
      style={{
        backgroundColor: displayedSettings.backgroundColor,
        backgroundImage:
          displayedSettings.backgroundMode === "image" &&
          displayedSettings.backgroundImageDataUrl
          ? `url("${displayedSettings.backgroundImageDataUrl}")`
          : undefined,
        backgroundPosition: "center",
        backgroundSize: "cover",
      }}
    >
      {displayedSettings.backgroundMode === "original" && (
        <Image
          alt=""
          className="object-cover"
          fill
          priority
          sizes="100vw"
          src="/landing.png"
        />
      )}
      {isPositioning && (
        <div className="pointer-events-none absolute inset-0 z-[5] border-2 border-dashed border-white/70" />
      )}
      {displayedSettings.logoDataUrl && (
        <div
          aria-label="Landing page logo"
          className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 ${
            isPositioning
              ? "touch-none cursor-move rounded-lg outline outline-2 outline-dashed outline-white"
              : "pointer-events-none"
          }`}
          onPointerDown={
            isPositioning ? (event) => startPositionDrag("logo", event) : undefined
          }
          onPointerMove={isPositioning ? updatePositionDrag : undefined}
          onPointerUp={isPositioning ? finishPositionDrag : undefined}
          role={isPositioning ? "group" : undefined}
          style={{
            left: `${displayedSettings.logoX}%`,
            top: `${displayedSettings.logoY}%`,
          }}
        >
          <Image
            alt="Landing page logo"
            className="h-auto max-h-36 w-auto max-w-[min(20rem,80vw)] object-contain drop-shadow-xl"
            draggable={false}
            height={144}
            src={displayedSettings.logoDataUrl}
            unoptimized
            width={320}
          />
        </div>
      )}
      {displayedSettings.images.map((image, index) => (
        <div
          aria-label={`Landing page image ${index + 1}`}
          className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 ${
            isPositioning
              ? "touch-none cursor-move rounded-lg outline outline-2 outline-dashed outline-white"
              : "pointer-events-none"
          }`}
          key={image.id}
          onPointerDown={
            isPositioning
              ? (event) => startPositionDrag(`image:${image.id}`, event)
              : undefined
          }
          onPointerMove={isPositioning ? updatePositionDrag : undefined}
          onPointerUp={isPositioning ? finishPositionDrag : undefined}
          style={{
            left: `${image.x}%`,
            top: `${image.y}%`,
            width: `${image.width}%`,
          }}
        >
          <Image
            alt=""
            className="h-auto w-full object-contain drop-shadow-xl"
            draggable={false}
            height={600}
            src={image.dataUrl}
            unoptimized
            width={800}
          />
        </div>
      ))}
      {displayedSettings.welcomeEnabled && (
        <div
          aria-label="Welcome message"
          className={`absolute z-10 max-w-[min(36rem,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/30 bg-black/35 px-6 py-5 text-center font-semibold shadow-xl shadow-black/20 backdrop-blur-xl ${
            isPositioning
              ? "touch-none cursor-move outline outline-2 outline-dashed outline-white"
              : "pointer-events-none"
          }`}
          onPointerDown={
            isPositioning ? (event) => startPositionDrag("welcome", event) : undefined
          }
          onPointerMove={isPositioning ? updatePositionDrag : undefined}
          onPointerUp={isPositioning ? finishPositionDrag : undefined}
          role={isPositioning ? "group" : undefined}
          style={{
            left: `${displayedSettings.welcomeX}%`,
            top: `${displayedSettings.welcomeY}%`,
            whiteSpace: "pre-wrap",
            color: displayedSettings.welcomeColor,
            fontFamily: displayedSettings.welcomeFontFamily,
            fontSize: `${displayedSettings.welcomeFontSize}px`,
          }}
        >
          {displayedSettings.welcomeText}
        </div>
      )}
      {sessionUser &&
        availableWidgets.filter((widget) => landingWidgetIds.includes(widget.id)).length > 0 && (
          <div className="pointer-events-none absolute inset-0 z-20">
            {availableWidgets
              .filter((widget) => landingWidgetIds.includes(widget.id))
              .map((widget) => {
                const widgetIndex = landingWidgetIds.indexOf(widget.id);
                const position =
                  (isWidgetPositioning
                    ? widgetDraftPositions[widget.id]
                    : landingWidgetPositions[widget.id]) ??
                  defaultLandingWidgetPosition(widgetIndex);
                return (
                  <div
                    aria-label={`${widget.title} landing page widget`}
                    className={`pointer-events-auto absolute w-[min(90vw,24rem)] -translate-x-1/2 -translate-y-1/2 sm:w-[min(22vw,24rem)] ${
                      widget.type === "embed" ||
                      widget.type === "home-assistant-dashboard"
                        ? "h-[35vh] min-h-48"
                        : ""
                    } ${
                      isWidgetPositioning
                        ? "touch-none cursor-move rounded-lg outline outline-2 outline-dashed outline-white/80"
                        : ""
                    }`}
                    key={widget.id}
                    onPointerDown={
                      isWidgetPositioning
                        ? (event) => startPositionDrag(`widget:${widget.id}`, event)
                        : undefined
                    }
                    onPointerMove={
                      isWidgetPositioning ? updatePositionDrag : undefined
                    }
                    onPointerUp={
                      isWidgetPositioning ? finishPositionDrag : undefined
                    }
                    role={isWidgetPositioning ? "group" : undefined}
                    style={{
                      left: `${position.x}%`,
                      top: `${position.y}%`,
                    }}
                  >
                    <DashboardCardContent
                      card={widget}
                      homeAssistantBaseUrl={homeAssistantBaseUrl}
                    />
                  </div>
                );
              })}
          </div>
        )}
      {error && (
        <p
          className="fixed left-1/2 top-4 z-50 max-w-[90vw] -translate-x-1/2 rounded-lg bg-red-950/90 px-4 py-2 text-sm text-white shadow-lg"
          role="alert"
        >
          {error}
        </p>
      )}
      {sessionUser?.role === "admin" && !isPositioning && !isWidgetPositioning && (
        <button
          className="fixed bottom-5 left-5 z-20 rounded-full border border-white/50 bg-transparent px-5 py-2.5 text-sm font-semibold text-white shadow-lg backdrop-blur-md transition hover:border-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          onClick={() => {
            setDraft(settings);
            setError("");
            setIsCustomizeOpen(true);
          }}
          type="button"
        >
          Landing page settings
        </button>
      )}
      {isPositioning && (
        <div className="fixed left-1/2 top-4 z-30 flex -translate-x-1/2 flex-wrap justify-center gap-2 rounded-xl border border-white/25 bg-black/65 p-2 text-sm text-white shadow-xl backdrop-blur-lg">
          <span className="px-2 py-1.5">Drag the logo, images, and text box to position them.</span>
          <button
            className="rounded-lg border border-white/50 bg-transparent px-3 py-1.5 font-semibold hover:border-white"
            onClick={() => void saveSettings(draft)}
            type="button"
          >
            Save layout
          </button>
          <button
            className="rounded-lg border border-white/30 bg-transparent px-3 py-1.5 hover:border-white"
            onClick={() => {
              setDraft(settings);
              setIsPositioning(false);
              setError("");
            }}
            type="button"
          >
            Cancel
          </button>
        </div>
      )}
      {isWidgetPositioning && (
        <div className="fixed left-1/2 top-4 z-30 flex -translate-x-1/2 flex-wrap justify-center gap-2 rounded-xl border border-white/25 bg-black/65 p-2 text-sm text-white shadow-xl backdrop-blur-lg">
          <span className="px-2 py-1.5">Drag widgets into place, then save.</span>
          <button
            className="rounded-lg border border-white/50 bg-transparent px-3 py-1.5 font-semibold hover:border-white"
            onClick={() => void saveLandingWidgets(widgetDraftIds, widgetDraftPositions)}
            type="button"
          >
            Save widget layout
          </button>
          <button
            className="rounded-lg border border-white/30 bg-transparent px-3 py-1.5 hover:border-white"
            onClick={() => {
              setWidgetDraftPositions(landingWidgetPositions);
              setIsWidgetPositioning(false);
              setError("");
            }}
            type="button"
          >
            Cancel
          </button>
        </div>
      )}
      {sessionUser ? (
        <div className="fixed bottom-5 right-5 z-20 flex max-w-[calc(100vw-2.5rem)] flex-wrap items-center justify-end gap-2">
          <span className="flex items-center gap-2 rounded-full border border-white/30 bg-black/45 py-1.5 pl-1.5 pr-3 text-sm text-white backdrop-blur-sm">
            <Image
              alt=""
              className="h-7 w-7 rounded-full bg-white/10 object-cover"
              height={28}
              src={avatarImageSource(sessionUser.avatar)}
              unoptimized
              width={28}
            />
            <span className="hidden max-w-[8rem] truncate sm:inline">{sessionUser.displayName}</span>
          </span>
          <button
            className="rounded-full border border-fuchsia-300/60 bg-black/45 px-5 py-2.5 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition hover:border-fuchsia-200 hover:bg-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-300"
            onClick={() => router.push("/dashboard")}
            type="button"
          >
            Dashboard
          </button>
          {landingWidgetIds.length > 0 && !isWidgetPositioning && (
            <button
              className="rounded-full border border-white/30 bg-black/45 px-4 py-2.5 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition hover:border-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              onClick={() => {
                setWidgetDraftPositions(landingWidgetPositions);
                setIsWidgetPositioning(true);
              }}
              type="button"
            >
              Arrange widgets
            </button>
          )}
          {!isWidgetPositioning && (
            <button
              className="rounded-full border border-white/30 bg-black/45 px-4 py-2.5 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition hover:border-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              onClick={() => {
                setWidgetDraftIds(landingWidgetIds);
                setIsWidgetModalOpen(true);
              }}
              type="button"
            >
              Landing widgets
            </button>
          )}
          <button
            className="rounded-full border border-white/30 bg-black/45 px-4 py-2.5 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition hover:border-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            onClick={() => void signOut()}
            type="button"
          >
            Log out
          </button>
        </div>
      ) : (
        <button
          className="fixed bottom-5 right-5 z-20 rounded-full border border-fuchsia-300/60 bg-black/45 px-5 py-2.5 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition hover:border-fuchsia-200 hover:bg-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-300"
          onClick={() => setIsModalOpen(true)}
          type="button"
        >
          Log in
        </button>
      )}

      {isWidgetModalOpen && sessionUser && !isWidgetPositioning && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsWidgetModalOpen(false);
          }}
          role="presentation"
        >
          <section
            aria-labelledby="landing-widgets-title"
            aria-modal="true"
            className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            role="dialog"
          >
            <h2 className="text-xl font-bold" id="landing-widgets-title">
              Landing page widgets
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Choose objects from your dashboards. These widgets are private and only load while you are signed in.
            </p>
            <div className="mt-4 space-y-2">
              {availableWidgets.length === 0 ? (
                <p className="rounded-lg bg-zinc-100 p-3 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  Add objects to a dashboard before placing them here.
                </p>
              ) : (
                availableWidgets.map((widget) => (
                  <label
                    className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-700"
                    key={widget.id}
                  >
                    <input
                      checked={widgetDraftIds.includes(widget.id)}
                      onChange={(event) => {
                        if (
                          event.target.checked &&
                          widgetDraftIds.length >= 24
                        ) {
                          setError("You can show up to 24 landing page widgets.");
                          return;
                        }
                        setWidgetDraftIds((current) =>
                          event.target.checked
                            ? [...current, widget.id]
                            : current.filter((id) => id !== widget.id),
                        );
                      }}
                      type="checkbox"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{widget.title}</span>
                      <span className="block text-xs text-zinc-500">{widget.type}</span>
                    </span>
                  </label>
                ))
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
                onClick={() => {
                  setIsWidgetModalOpen(false);
                  setWidgetDraftIds(landingWidgetIds);
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-lg border border-indigo-500 px-4 py-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300"
                onClick={() => {
                  const nextPositions = Object.fromEntries(
                    widgetDraftIds.map((id, index) => [
                      id,
                      widgetDraftPositions[id] ??
                        landingWidgetPositions[id] ??
                        defaultLandingWidgetPosition(index),
                    ]),
                  );
                  void saveLandingWidgets(widgetDraftIds, nextPositions);
                }}
                type="button"
              >
                Save widgets
              </button>
            </div>
          </section>
        </div>
      )}

      {isCustomizeOpen && sessionUser?.role === "admin" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsCustomizeOpen(false);
          }}
          role="presentation"
        >
          <section
            aria-labelledby="landing-customize-title"
            aria-modal="true"
            className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold" id="landing-customize-title">
                  Landing page settings
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Customize the background and position your images and welcome text.
                </p>
              </div>
              <button
                aria-label="Close landing page customization"
                className="rounded-md px-2 text-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                onClick={() => setIsCustomizeOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>
            <div className="mt-5 flex gap-2 border-b border-zinc-200 dark:border-zinc-700">
              {[
                { id: "background" as const, label: "Background" },
                { id: "elements" as const, label: "Images & text" },
              ].map((tab) => (
                <button
                  aria-pressed={settingsTab === tab.id}
                  className={`border-b-2 px-3 py-2 text-sm font-semibold transition ${
                    settingsTab === tab.id
                      ? "border-indigo-500 text-indigo-700 dark:text-indigo-300"
                      : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                  key={tab.id}
                  onClick={() => setSettingsTab(tab.id)}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {settingsTab === "background" ? (
              <section className="mt-5 space-y-4" aria-label="Landing page background settings">
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ["original", "Original artwork"],
                    ["color", "Solid color"],
                    ["image", "Custom image"],
                  ] as const).map(([mode, label]) => (
                    <button
                      aria-pressed={draft.backgroundMode === mode}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                        draft.backgroundMode === mode
                          ? "border-indigo-500 text-indigo-700 dark:text-indigo-300"
                          : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
                      }`}
                      key={mode}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          backgroundMode: mode,
                        }))
                      }
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3 text-sm font-semibold dark:border-zinc-700">
                    <input
                      aria-label="Landing page background color"
                      className="h-12 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          backgroundMode: "color",
                          backgroundColor: event.target.value,
                        }))
                      }
                      type="color"
                      value={draft.backgroundColor}
                    />
                    <span>
                      <span className="block">Background color</span>
                      <span className="text-xs font-normal text-zinc-500">
                        {draft.backgroundColor}
                      </span>
                    </span>
                  </label>
                  {draft.backgroundMode === "image" ? (
                    <div>
                      <label className="block text-sm font-semibold" htmlFor="landing-background-image">
                        Background image
                        <input
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="mt-2 block w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-transparent file:px-2 file:py-1 file:font-semibold dark:border-zinc-700"
                          id="landing-background-image"
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0];
                            event.currentTarget.value = "";
                            setLandingBackground(file);
                          }}
                          type="file"
                        />
                      </label>
                      <p className="mt-1 text-xs text-zinc-500">
                        PNG, JPEG, WebP, or GIF up to 12 MB.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center text-xs text-zinc-500">
                      {draft.backgroundMode === "original"
                        ? "Using the original Evil-Lander artwork."
                        : "Using the selected solid background color."}
                    </div>
                  )}
                </div>
                <p className="text-xs text-zinc-500">
                  Background uploads support PNG, JPEG, WebP, or GIF up to 12 MB. Total landing page uploads are limited to 24 MB.
                </p>
                {draft.backgroundMode === "image" && draft.backgroundImageDataUrl && (
                  <div className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
                    <Image
                      alt="Landing page background preview"
                      className="h-20 w-36 rounded-lg object-cover"
                      height={80}
                      src={draft.backgroundImageDataUrl}
                      unoptimized
                      width={144}
                    />
                    <button
                      className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs hover:border-red-500 hover:text-red-600 dark:border-zinc-700"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          backgroundMode: "original",
                          backgroundImageDataUrl: null,
                        }))
                      }
                      type="button"
                    >
                      Use original background
                    </button>
                  </div>
                )}
              </section>
            ) : (
              <section className="mt-5 space-y-5" aria-label="Landing page images and text settings">
                <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
                  <h3 className="text-sm font-bold">Logo image</h3>
                  <label className="mt-3 block text-sm font-medium" htmlFor="landing-logo">
                    Upload or replace logo
                    <input
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="mt-2 block w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-transparent file:px-2 file:py-1 file:font-semibold dark:border-zinc-700"
                      id="landing-logo"
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        event.currentTarget.value = "";
                        readImageFile(file, (dataUrl) =>
                          setDraft((current) => ({ ...current, logoDataUrl: dataUrl })),
                        );
                      }}
                      type="file"
                    />
                  </label>
                  {draft.logoDataUrl && (
                    <div className="mt-3 flex items-center gap-3">
                      <Image
                        alt="Selected logo preview"
                        className="h-12 w-24 object-contain"
                        height={48}
                        src={draft.logoDataUrl}
                        unoptimized
                        width={96}
                      />
                      <button
                        className="rounded-lg border border-zinc-300 bg-transparent px-3 py-1.5 text-xs hover:border-red-500 hover:text-red-600 dark:border-zinc-700"
                        onClick={() =>
                          setDraft((current) => ({ ...current, logoDataUrl: null }))
                        }
                        type="button"
                      >
                        Remove logo
                      </button>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold">Additional images</h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        Add decorative images, then drag them into place.
                      </p>
                    </div>
                    <label className="cursor-pointer rounded-lg border border-indigo-500 bg-transparent px-3 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                      Add image
                      <input
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          event.currentTarget.value = "";
                          addLandingImage(file);
                        }}
                        type="file"
                      />
                    </label>
                  </div>
                  {draft.images.length > 0 && (
                    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                      {draft.images.map((image, index) => (
                        <li
                          className="flex min-w-0 items-center gap-3 rounded-lg border border-zinc-200 p-2 dark:border-zinc-700"
                          key={image.id}
                        >
                          <Image
                            alt={`Landing page image ${index + 1} preview`}
                            className="h-12 w-16 shrink-0 object-contain"
                            height={48}
                            src={image.dataUrl}
                            unoptimized
                            width={64}
                          />
                          <label className="min-w-0 flex-1 text-xs font-medium">
                            Width
                            <input
                              className="mt-1 w-full accent-indigo-600"
                              max={70}
                              min={5}
                              onChange={(event) =>
                                setDraft((current) => ({
                                  ...current,
                                  images: current.images.map((entry) =>
                                    entry.id === image.id
                                      ? { ...entry, width: Number(event.target.value) }
                                      : entry,
                                  ),
                                }))
                              }
                              type="range"
                              value={image.width}
                            />
                          </label>
                          <button
                            aria-label={`Remove image ${index + 1}`}
                            className="rounded border border-zinc-300 px-2 py-1 text-xs text-red-600 dark:border-zinc-700"
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                images: current.images.filter(
                                  (entry) => entry.id !== image.id,
                                ),
                              }))
                            }
                            type="button"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-3 text-xs text-zinc-500">
                    Up to 8 images; each image can be up to 12 MB, with 24 MB total across all uploads.
                  </p>
                </div>

                <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
                  <label className="flex items-center gap-2 text-sm font-bold">
                    <input
                      checked={draft.welcomeEnabled}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          welcomeEnabled: event.target.checked,
                          welcomeText:
                            event.target.checked && !current.welcomeText
                              ? "Welcome to Evil-Lander"
                              : current.welcomeText,
                        }))
                      }
                      type="checkbox"
                    />
                    Show movable welcome text box
                  </label>
                  <label className="mt-3 block text-sm font-medium" htmlFor="landing-welcome">
                    Text
                    <textarea
                      className="mt-2 min-h-20 w-full resize-y rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 disabled:opacity-50 dark:border-zinc-700"
                      disabled={!draft.welcomeEnabled}
                      id="landing-welcome"
                      maxLength={500}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          welcomeText: event.target.value,
                        }))
                      }
                      placeholder="Welcome to Evil-Lander"
                      value={draft.welcomeText}
                    />
                  </label>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <label className="text-sm font-medium" htmlFor="landing-font-family">
                      Font
                      <select
                        className="mt-1 w-full rounded-lg border border-zinc-300 bg-transparent px-2 py-2 text-sm dark:border-zinc-700"
                        disabled={!draft.welcomeEnabled}
                        id="landing-font-family"
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            welcomeFontFamily: event.target.value,
                          }))
                        }
                        style={{ fontFamily: draft.welcomeFontFamily }}
                        value={draft.welcomeFontFamily}
                      >
                        {[
                          ["system-ui", "System"],
                          ["Arial", "Arial"],
                          ["Georgia", "Georgia"],
                          ["Times New Roman", "Times New Roman"],
                          ["Courier New", "Courier New"],
                          ["Trebuchet MS", "Trebuchet MS"],
                          ["Verdana", "Verdana"],
                          ["Impact", "Impact"],
                        ].map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm font-medium" htmlFor="landing-font-size">
                      Text size ({draft.welcomeFontSize}px)
                      <input
                        className="mt-3 w-full accent-indigo-600"
                        disabled={!draft.welcomeEnabled}
                        id="landing-font-size"
                        max={96}
                        min={14}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            welcomeFontSize: Number(event.target.value),
                          }))
                        }
                        type="range"
                        value={draft.welcomeFontSize}
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium">
                      Text color
                      <input
                        aria-label="Welcome text color"
                        className="h-9 w-12 cursor-pointer rounded border-0 bg-transparent p-0"
                        disabled={!draft.welcomeEnabled}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            welcomeColor: event.target.value,
                          }))
                        }
                        type="color"
                        value={draft.welcomeColor}
                      />
                    </label>
                  </div>
                  <p
                    className="mt-4 rounded-xl border border-white/25 bg-black/35 px-4 py-3 text-center shadow backdrop-blur"
                    style={{
                      color: draft.welcomeColor,
                      fontFamily: draft.welcomeFontFamily,
                      fontSize: `${Math.min(draft.welcomeFontSize, 36)}px`,
                    }}
                  >
                    {draft.welcomeText || "Welcome to Evil-Lander"}
                  </p>
                </div>
              </section>
            )}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                className="rounded-lg border border-zinc-300 bg-transparent px-4 py-2 text-sm font-medium hover:border-zinc-500 dark:border-zinc-700"
                onClick={() => setIsCustomizeOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-lg border border-indigo-500 bg-transparent px-4 py-2 text-sm font-semibold text-indigo-700 hover:border-indigo-700 dark:text-indigo-300"
                onClick={() => {
                  setIsCustomizeOpen(false);
                  setSettingsTab("elements");
                  setIsPositioning(true);
                }}
                type="button"
              >
                Arrange on page
              </button>
              <button
                className="rounded-lg border border-indigo-500 bg-transparent px-4 py-2 text-sm font-semibold text-indigo-700 hover:border-indigo-700 dark:text-indigo-300"
                onClick={() => void saveSettings(draft)}
                type="button"
              >
                Save changes
              </button>
            </div>
          </section>
        </div>
      )}

      {isModalOpen && (
        <LoginModal
          onClose={() => setIsModalOpen(false)}
          onLoginSuccess={() => router.push("/dashboard")}
        />
      )}
    </main>
  );
}
