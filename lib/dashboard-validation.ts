import {
  dashboardCardTypes,
  dashboardLayouts,
  type DashboardCardInput,
  type DashboardCardType,
  type DashboardLayout,
} from "@/lib/dashboard-data";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCardType(value: unknown): value is DashboardCardType {
  return typeof value === "string" && dashboardCardTypes.some((type) => type === value);
}

function isLayout(value: unknown): value is DashboardLayout {
  return typeof value === "string" && dashboardLayouts.some((layout) => layout === value);
}

async function readJson(request: Request) {
  try {
    const value: unknown = await request.json();
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

function isSafeWebUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export async function readSectionTitle(request: Request) {
  const body = await readJson(request);
  if (
    !body ||
    typeof body.title !== "string" ||
    body.title.trim().length === 0 ||
    body.title.trim().length > 60
  ) {
    return null;
  }
  return body.title.trim();
}

export async function readDashboardInput(request: Request) {
  const body = await readJson(request);
  if (
    !body ||
    typeof body.title !== "string" ||
    body.title.trim().length === 0 ||
    body.title.trim().length > 80 ||
    (body.kind !== "desktop" && body.kind !== "iframe")
  ) {
    return null;
  }
  if (body.kind === "iframe") {
    if (!isSafeWebUrl(body.iframeUrl)) return null;
    return {
      title: body.title.trim(),
      kind: "iframe" as const,
      iframeUrl: new URL(body.iframeUrl).toString(),
    };
  }
  return { title: body.title.trim(), kind: "desktop" as const };
}

export async function readCardInput(
  request: Request,
): Promise<DashboardCardInput | null> {
  const body = await readJson(request);
  if (
    !body ||
    typeof body.sectionId !== "string" ||
    !isCardType(body.type) ||
    typeof body.title !== "string" ||
    body.title.trim().length === 0 ||
    body.title.trim().length > 80 ||
    typeof body.colSpan !== "number" ||
    !Number.isInteger(body.colSpan) ||
    body.colSpan < 1 ||
    body.colSpan > 4 ||
    typeof body.rowSpan !== "number" ||
    !Number.isInteger(body.rowSpan) ||
    body.rowSpan < 1 ||
    body.rowSpan > 3 ||
    typeof body.floatX !== "number" ||
    !Number.isFinite(body.floatX) ||
    body.floatX < 0 ||
    body.floatX > 100 ||
    typeof body.floatY !== "number" ||
    !Number.isInteger(body.floatY) ||
    body.floatY < 0 ||
    body.floatY > 20000 ||
    typeof body.floatWidth !== "number" ||
    !Number.isFinite(body.floatWidth) ||
    body.floatWidth < 10 ||
    body.floatWidth > 100 ||
    body.floatX + body.floatWidth > 100 ||
    typeof body.floatHeight !== "number" ||
    !Number.isInteger(body.floatHeight) ||
    body.floatHeight < 120 ||
    body.floatHeight > 2000 ||
    !isRecord(body.config)
  ) {
    return null;
  }

  const type = body.type;
  const config = body.config;
  if (
    config.displayMode !== undefined &&
    config.displayMode !== "widget" &&
    config.displayMode !== "button"
  ) {
    return null;
  }
  if (
    config.iconUrl !== undefined &&
    config.iconUrl !== "" &&
    !isSafeWebUrl(config.iconUrl)
  ) {
    return null;
  }
  let safeConfig: Record<string, string>;

  switch (type) {
    case "clock":
    case "calendar":
      safeConfig = {};
      break;
    case "markdown":
      if (
        typeof config.markdown !== "string" ||
        config.markdown.length > 10000
      ) {
        return null;
      }
      safeConfig = { markdown: config.markdown };
      break;
    case "link":
    case "button":
      if (
        !isSafeWebUrl(config.url) ||
        (type === "button" &&
          config.label !== undefined &&
          (typeof config.label !== "string" || config.label.trim().length > 60)) ||
        (config.description !== undefined &&
          (typeof config.description !== "string" ||
            config.description.length > 240))
      ) {
        return null;
      }
      safeConfig = {
        url: new URL(config.url).toString(),
        ...(type === "button"
          ? {
              label:
                typeof config.label === "string" && config.label.trim()
                  ? config.label.trim()
                  : "Open",
            }
          : {}),
        description:
          typeof config.description === "string" ? config.description.trim() : "",
      };
      break;
    case "image":
      if (
        !isSafeWebUrl(config.url) ||
        (config.alt !== undefined &&
          (typeof config.alt !== "string" || config.alt.length > 200))
      ) {
        return null;
      }
      safeConfig = {
        url: new URL(config.url).toString(),
        alt: typeof config.alt === "string" ? config.alt.trim() : "",
      };
      break;
    case "embed":
      if (!isSafeWebUrl(config.url)) return null;
      safeConfig = { url: new URL(config.url).toString() };
      break;
    case "home-assistant-dashboard":
      if (
        typeof config.path !== "string" ||
        config.path.length > 1024 ||
        !config.path.startsWith("/") ||
        config.path.startsWith("//") ||
        config.path.includes("\\")
      ) {
        return null;
      }
      try {
        const url = new URL(config.path, "http://homeassistant.local");
        if (url.origin !== "http://homeassistant.local") return null;
        safeConfig = { path: `${url.pathname}${url.search}${url.hash}` };
      } catch {
        return null;
      }
      break;
    case "weather":
      if (
        (config.provider !== undefined &&
          config.provider !== "home-assistant" &&
          config.provider !== "open-meteo") ||
        (config.units !== undefined &&
          config.units !== "imperial" &&
          config.units !== "metric") ||
        (config.forecastType !== undefined &&
          config.forecastType !== "daily" &&
          config.forecastType !== "hourly" &&
          config.forecastType !== "twice_daily")
      ) {
        return null;
      }
      if (config.provider === "home-assistant") {
        if (
          typeof config.entityId !== "string" ||
          !/^weather\.[a-z0-9_]+$/i.test(config.entityId)
        ) {
          return null;
        }
        safeConfig = {
          provider: "home-assistant",
          entityId: config.entityId,
          units: config.units === "metric" ? "metric" : "imperial",
          forecastType:
            config.forecastType === "hourly" || config.forecastType === "twice_daily"
              ? config.forecastType
              : "daily",
        };
      } else {
        if (
          typeof config.location !== "string" ||
          config.location.trim().length === 0 ||
          config.location.trim().length > 100
        ) {
          return null;
        }
        safeConfig = {
          provider: "open-meteo",
          location: config.location.trim(),
          units: config.units === "metric" ? "metric" : "imperial",
          forecastType:
            config.forecastType === "hourly"
              ? config.forecastType
              : "daily",
        };
      }
      break;
    case "home-assistant":
    case "home-assistant-light":
    case "home-assistant-fan":
    case "home-assistant-thermostat":
      if (
        typeof config.entityId !== "string" ||
        !/^[a-z0-9_]+\.[a-z0-9_]+$/i.test(config.entityId) ||
        (type === "home-assistant-light" &&
          !config.entityId.toLowerCase().startsWith("light.")) ||
        (type === "home-assistant-fan" &&
          !config.entityId.toLowerCase().startsWith("fan.")) ||
        (type === "home-assistant-thermostat" &&
          !config.entityId.toLowerCase().startsWith("climate."))
      ) {
        return null;
      }
      safeConfig = { entityId: config.entityId };
      break;
  }

  return {
    sectionId: body.sectionId,
    type,
    title: body.title.trim(),
    config: {
      ...safeConfig,
      ...(typeof config.iconUrl === "string" && config.iconUrl.trim()
        ? { iconUrl: new URL(config.iconUrl).toString() }
        : {}),
      ...(config.displayMode === "widget" || config.displayMode === "button"
        ? { displayMode: config.displayMode }
        : {}),
    },
    colSpan: body.colSpan,
    rowSpan: body.rowSpan,
    floatX: body.floatX,
    floatY: body.floatY,
    floatWidth: body.floatWidth,
    floatHeight: body.floatHeight,
  };
}

export async function readLayout(request: Request): Promise<DashboardLayout | null> {
  const body = await readJson(request);
  if (
    !body ||
    !isLayout(body.layout)
  ) {
    return null;
  }
  return body.layout;
}

export async function readHomeAssistantSettings(request: Request) {
  const body = await readJson(request);
  if (!body || typeof body.baseUrl !== "string") return null;
  const baseUrl = body.baseUrl.trim().replace(/\/+$/, "");
  if (
    baseUrl.length > 2048 ||
    !isSafeWebUrl(baseUrl) ||
    typeof body.token !== "string" ||
    body.token.length > 4096
  ) {
    return null;
  }

  return { baseUrl, token: body.token.trim() };
}

export async function readIdList(request: Request) {
  const body = await readJson(request);
  if (
    !body ||
    !Array.isArray(body.ids) ||
    !body.ids.every(
      (id) => typeof id === "string" && id.length > 0 && id.length <= 64,
    ) ||
    new Set(body.ids).size !== body.ids.length
  ) {
    return null;
  }
  return body.ids;
}
