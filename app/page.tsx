"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  defaultLandingPageSettings,
  type LandingPageSettings,
} from "@/lib/landing-page-shared";

type AuthMode = "login" | "signup";

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [settings, setSettings] = useState(defaultLandingPageSettings);
  const [draft, setDraft] = useState(defaultLandingPageSettings);
  const [error, setError] = useState("");
  const mainRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{
    item: "logo" | "welcome";
    pointerId: number;
    pointerX: number;
    pointerY: number;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadSettings = async () => {
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
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load landing page customization.",
          );
        }
      }
    };
    const loadSession = async () => {
      try {
        const response = await fetch("/api/auth/session", {
          signal: controller.signal,
        });
        const result: unknown = await response.json();
        if (!response.ok) throw new Error("Unable to check landing page permissions.");
        setIsAdmin(
          typeof result === "object" &&
            result !== null &&
            "user" in result &&
            typeof result.user === "object" &&
            result.user !== null &&
            "role" in result.user &&
            result.user.role === "admin",
        );
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
    void loadSettings();
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

  const startPositionDrag = (
    item: "logo" | "welcome",
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const element = event.currentTarget;
    const stage = mainRef.current;
    if (!stage || event.button !== 0) return;
    const x = item === "logo" ? draft.logoX : draft.welcomeX;
    const y = item === "logo" ? draft.logoY : draft.welcomeY;
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
    setDraft((current) =>
      drag.item === "logo"
        ? { ...current, logoX: x, logoY: y }
        : { ...current, welcomeX: x, welcomeY: y },
    );
  };

  const finishPositionDrag = () => {
    dragRef.current = null;
  };

  const readLogoFile = (file: File | undefined) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      setError("Choose a PNG, JPEG, WebP, or GIF logo image.");
      return;
    }
    if (file.size > 1_000_000) {
      setError("Logo images must be 1 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setError("The selected logo could not be read.");
        return;
      }
      setDraft((current) => ({ ...current, logoDataUrl: reader.result as string }));
      setError("");
    };
    reader.onerror = () => setError("The selected logo could not be read.");
    reader.readAsDataURL(file);
  };

  const displayedSettings = isPositioning ? draft : settings;

  return (
    <main
      className="relative min-h-svh w-full overflow-hidden bg-black"
      onPointerCancel={finishPositionDrag}
      ref={mainRef}
    >
      <Image
        alt=""
        className="object-cover"
        fill
        priority
        sizes="100vw"
        src="/landing.png"
      />
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
      {displayedSettings.welcomeEnabled && (
        <div
          aria-label="Welcome message"
          className={`absolute z-10 max-w-[min(36rem,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/30 bg-black/35 px-6 py-5 text-center text-lg font-semibold text-white shadow-xl shadow-black/20 backdrop-blur-xl ${
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
          }}
        >
          {displayedSettings.welcomeText}
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
      {isAdmin && !isPositioning && (
        <button
          className="fixed bottom-5 left-5 z-20 rounded-full border border-white/50 bg-transparent px-5 py-2.5 text-sm font-semibold text-white shadow-lg backdrop-blur-md transition hover:border-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          onClick={() => {
            setDraft(settings);
            setError("");
            setIsCustomizeOpen(true);
          }}
          type="button"
        >
          Customize landing page
        </button>
      )}
      {isPositioning && (
        <div className="fixed left-1/2 top-4 z-30 flex -translate-x-1/2 flex-wrap justify-center gap-2 rounded-xl border border-white/25 bg-black/65 p-2 text-sm text-white shadow-xl backdrop-blur-lg">
          <span className="px-2 py-1.5">Drag the logo and welcome box to position them.</span>
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
      <button
        className="fixed bottom-5 right-5 z-20 rounded-full border border-fuchsia-300/60 bg-black/45 px-5 py-2.5 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition hover:border-fuchsia-200 hover:bg-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-300"
        onClick={() => setIsModalOpen(true)}
        type="button"
      >
        Log in
      </button>

      {isCustomizeOpen && (
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
            className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold" id="landing-customize-title">
                  Customize landing page
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Add a logo or welcome message, then place them anywhere on the page.
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
            <label className="mt-5 block text-sm font-semibold" htmlFor="landing-logo">
              Logo image
              <input
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="mt-2 block w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-transparent file:px-2 file:py-1 file:font-semibold dark:border-zinc-700"
                id="landing-logo"
                onChange={(event) => readLogoFile(event.currentTarget.files?.[0])}
                type="file"
              />
              <span className="mt-1 block text-xs font-normal text-zinc-500">
                PNG, JPEG, WebP, or GIF; up to 1 MB.
              </span>
            </label>
            {draft.logoDataUrl && (
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
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
                  onClick={() => setDraft((current) => ({ ...current, logoDataUrl: null }))}
                  type="button"
                >
                  Remove logo
                </button>
              </div>
            )}
            <label className="mt-5 flex items-center gap-2 text-sm font-semibold">
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
              Show welcome text box
            </label>
            <label className="mt-3 block text-sm font-semibold" htmlFor="landing-welcome">
              Welcome text
              <textarea
                className="mt-2 min-h-24 w-full resize-y rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm font-normal outline-none focus:border-indigo-500 dark:border-zinc-700"
                disabled={!draft.welcomeEnabled}
                id="landing-welcome"
                maxLength={500}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, welcomeText: event.target.value }))
                }
                placeholder="Welcome to Evil-Lander"
                value={draft.welcomeText}
              />
            </label>
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
