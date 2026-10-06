import { getSessionUser } from "@/lib/auth";
import {
  getAdminUserId,
  getDashboardCard,
  getHomeAssistantCredentials,
} from "@/lib/dashboard-data";


type RouteContext = {
  params: Promise<{ id: string }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJsonResponse(response: Response) {
  if (!response.ok) {
    throw new Error(`Data provider returned HTTP ${response.status}.`);
  }
  const body: unknown = await response.json();
  if (!isRecord(body)) throw new Error("Data provider returned invalid data.");
  return body;
}

function convertTemperature(value: unknown, sourceUnit: string, target: "imperial" | "metric") {
  if (typeof value !== "number") return null;
  const celsius = sourceUnit.toLowerCase().includes("f")
    ? ((value - 32) * 5) / 9
    : value;
  return target === "imperial" ? (celsius * 9) / 5 + 32 : celsius;
}

function convertWindSpeed(value: unknown, sourceUnit: string, target: "imperial" | "metric") {
  if (typeof value !== "number") return null;
  const unit = sourceUnit.toLowerCase().replaceAll(" ", "");
  const metersPerSecond =
    unit === "mph" || unit === "mi/h"
      ? value * 0.44704
      : unit === "km/h" || unit === "kmh"
        ? value / 3.6
        : unit === "kn" || unit === "knot" || unit === "knots"
          ? value * 0.514444
          : value;
  return target === "imperial" ? metersPerSecond * 2.23694 : metersPerSecond * 3.6;
}

function convertPrecipitation(value: unknown, sourceUnit: string, target: "imperial" | "metric") {
  if (typeof value !== "number") return null;
  const unit = sourceUnit.toLowerCase();
  const millimeters = unit.includes("in") ? value * 25.4 : unit.includes("cm") ? value * 10 : value;
  return target === "imperial" ? millimeters / 25.4 : millimeters;
}

async function getOpenMeteoWeather(
  location: string,
  units: "imperial" | "metric",
  forecastType: "daily" | "hourly",
) {
  const geocodeUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  geocodeUrl.search = new URLSearchParams({
    name: location,
    count: "1",
    language: "en",
    format: "json",
  }).toString();
  const geocoding = await readJsonResponse(
    await fetch(geocodeUrl, { cache: "no-store", signal: AbortSignal.timeout(10000) }),
  );
  const results = Array.isArray(geocoding.results) ? geocoding.results : [];
  const place: unknown = results[0];
  if (!isRecord(place) || typeof place.latitude !== "number" || typeof place.longitude !== "number") {
    throw new Error("No matching location found. Check the location name.");
  }

  const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
  const forecastFields =
    forecastType === "daily"
      ? "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max"
      : "temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m";
  forecastUrl.search = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
    temperature_unit: units === "imperial" ? "fahrenheit" : "celsius",
    wind_speed_unit: units === "imperial" ? "mph" : "kmh",
    precipitation_unit: units === "imperial" ? "inch" : "mm",
    timezone: "auto",
    ...(forecastType === "daily"
      ? { daily: forecastFields, forecast_days: "5" }
      : { hourly: forecastFields, forecast_hours: "12" }),
  }).toString();
  const forecastData = await readJsonResponse(
    await fetch(forecastUrl, { cache: "no-store", signal: AbortSignal.timeout(10000) }),
  );
  if (!isRecord(forecastData.current)) throw new Error("Weather data is unavailable.");
  const forecastValues = isRecord(forecastData.daily)
    ? forecastData.daily
    : isRecord(forecastData.hourly)
      ? forecastData.hourly
      : {};
  const forecastTimes = Array.isArray(forecastValues.time) ? forecastValues.time : [];
  const at = (key: string, index: number) =>
    Array.isArray(forecastValues[key]) ? forecastValues[key][index] : null;
  const forecastItems = forecastTimes.map((time, index) => ({
    datetime: time,
    condition: at("weather_code", index),
    temperature: at("temperature_2m", index) ?? at("temperature_2m_max", index),
    templow: at("temperature_2m_min", index),
    precipitation_probability:
      at("precipitation_probability", index) ??
      at("precipitation_probability_max", index),
    precipitation: at("precipitation", index) ?? at("precipitation_sum", index),
    wind_speed: at("wind_speed_10m", index) ?? at("wind_speed_10m_max", index),
  }));

  return {
    location: [place.name, place.country].filter((part) => typeof part === "string").join(", "),
    condition: forecastData.current.weather_code ?? null,
    current: {
      temperature: forecastData.current.temperature_2m,
      apparent_temperature: forecastData.current.apparent_temperature,
      humidity: forecastData.current.relative_humidity_2m,
      wind_speed: forecastData.current.wind_speed_10m,
    },
    units: {
      temperature: units === "imperial" ? "°F" : "°C",
      wind_speed: units === "imperial" ? "mph" : "km/h",
      precipitation: units === "imperial" ? "in" : "mm",
    },
    forecast: forecastItems,
    forecastType,
  };
}

async function getHomeAssistantWeather(
  entityId: string,
  units: "imperial" | "metric",
  forecastType: "daily" | "hourly" | "twice_daily",
) {
  const adminId = getAdminUserId();
  const connection = adminId ? getHomeAssistantCredentials(adminId) : null;
  if (!connection) {
    throw new Error("The dashboard admin has not configured Home Assistant.");
  }
  const headers = { Authorization: "Bearer " + connection.token };
  const stateUrl = new URL(connection.baseUrl);
  stateUrl.pathname = `${stateUrl.pathname.replace(/\/+$/, "")}/api/states/${encodeURIComponent(entityId)}`;
  stateUrl.search = "";
  stateUrl.hash = "";
  const forecastUrl = new URL(connection.baseUrl);
  forecastUrl.pathname = `${forecastUrl.pathname.replace(/\/+$/, "")}/api/services/weather/get_forecasts`;
  forecastUrl.search = "?return_response";
  forecastUrl.hash = "";

  const [stateResponse, forecastResponse] = await Promise.all([
    fetch(stateUrl, {
      cache: "no-store",
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    }),
    fetch(forecastUrl, {
      method: "POST",
      cache: "no-store",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ entity_id: entityId, type: forecastType }),
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    }),
  ]);
  const [state, forecastResponseBody] = await Promise.all([
    readJsonResponse(stateResponse),
    forecastResponse.json() as Promise<unknown>,
  ]);
  if (!isRecord(forecastResponseBody)) {
    throw new Error("Home Assistant returned invalid forecast data.");
  }
  if (!forecastResponse.ok) {
    throw new Error(`Home Assistant forecast request failed (HTTP ${forecastResponse.status}).`);
  }
  const serviceResponse = isRecord(forecastResponseBody.service_response)
    ? forecastResponseBody.service_response
    : forecastResponseBody;
  const entityForecast = serviceResponse[entityId];
  const forecastData = isRecord(entityForecast) ? entityForecast.forecast : null;
  if (!Array.isArray(forecastData)) {
    throw new Error("Home Assistant did not return a forecast for this weather entity.");
  }
  const attributes = isRecord(state.attributes) ? state.attributes : {};
  const temperatureUnit =
    typeof attributes.temperature_unit === "string" ? attributes.temperature_unit : "°C";
  const windSpeedUnit =
    typeof attributes.wind_speed_unit === "string" ? attributes.wind_speed_unit : "m/s";
  const precipitationUnit =
    typeof attributes.precipitation_unit === "string" ? attributes.precipitation_unit : "mm";
  const convertForecastItem = (item: unknown) => {
    if (!isRecord(item)) return null;
    return {
      datetime: item.datetime ?? null,
      condition: item.condition ?? null,
      temperature: convertTemperature(item.temperature, temperatureUnit, units),
      templow: convertTemperature(item.templow, temperatureUnit, units),
      apparent_temperature: convertTemperature(
        item.apparent_temperature,
        temperatureUnit,
        units,
      ),
      humidity: typeof item.humidity === "number" ? item.humidity : null,
      precipitation_probability:
        typeof item.precipitation_probability === "number"
          ? item.precipitation_probability
          : null,
      precipitation: convertPrecipitation(item.precipitation, precipitationUnit, units),
      wind_speed: convertWindSpeed(item.wind_speed, windSpeedUnit, units),
    };
  };

  return {
    location:
      typeof attributes.friendly_name === "string"
        ? attributes.friendly_name
        : entityId,
    condition: typeof state.state === "string" ? state.state : "unknown",
    current: {
      temperature: convertTemperature(attributes.temperature, temperatureUnit, units),
      apparent_temperature: convertTemperature(
        attributes.apparent_temperature,
        temperatureUnit,
        units,
      ),
      humidity: attributes.humidity ?? null,
      wind_speed: convertWindSpeed(attributes.wind_speed, windSpeedUnit, units),
    },
    units: {
      temperature: units === "imperial" ? "°F" : "°C",
      wind_speed: units === "imperial" ? "mph" : "km/h",
      precipitation: units === "imperial" ? "in" : "mm",
    },
    forecast: forecastData.map(convertForecastItem).filter((item) => item !== null).slice(0, 12),
    forecastType,
  };
}

async function getHomeAssistantState(entityId: string) {
  const adminId = getAdminUserId();
  const connection = adminId ? getHomeAssistantCredentials(adminId) : null;
  if (!connection) {
    throw new Error("The dashboard admin has not configured Home Assistant.");
  }

  const base = new URL(connection.baseUrl);
  base.pathname = `${base.pathname.replace(/\/+$/, "")}/api/states/${encodeURIComponent(entityId)}`;
  base.search = "";
  base.hash = "";
  const response = await fetch(base, {
    cache: "no-store",
    headers: { Authorization: "Bearer " + connection.token },
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  const state = await readJsonResponse(response);
  const attributes = isRecord(state.attributes) ? state.attributes : {};
  return {
    entityId,
    state: typeof state.state === "string" ? state.state : "unknown",
    friendlyName:
      typeof attributes.friendly_name === "string"
        ? attributes.friendly_name
        : entityId,
    unit: typeof attributes.unit_of_measurement === "string"
      ? attributes.unit_of_measurement
      : "",
    lastChanged: typeof state.last_changed === "string" ? state.last_changed : "",
  };
}

type LightControl =
  | { action: "toggle" }
  | { action: "brightness"; value: number }
  | { action: "color"; value: [number, number, number] }
  | { action: "color_temp"; value: number };

type FanControl =
  | { action: "toggle" }
  | { action: "percentage"; value: number }
  | { action: "direction"; value: "forward" | "reverse" };

type ThermostatControl =
  | { action: "temperature"; value: number }
  | { action: "hvac_mode"; value: string };

async function readLightControl(request: Request): Promise<LightControl | null> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }
  if (!isRecord(body) || typeof body.action !== "string") return null;
  if (body.action === "toggle") return { action: "toggle" };
  if (
    body.action === "brightness" &&
    typeof body.value === "number" &&
    Number.isInteger(body.value) &&
    body.value >= 1 &&
    body.value <= 255
  ) {
    return { action: "brightness", value: body.value };
  }
  if (
    body.action === "color" &&
    Array.isArray(body.value) &&
    body.value.length === 3 &&
    typeof body.value[0] === "number" &&
    Number.isInteger(body.value[0]) &&
    body.value[0] >= 0 &&
    body.value[0] <= 255 &&
    typeof body.value[1] === "number" &&
    Number.isInteger(body.value[1]) &&
    body.value[1] >= 0 &&
    body.value[1] <= 255 &&
    typeof body.value[2] === "number" &&
    Number.isInteger(body.value[2]) &&
    body.value[2] >= 0 &&
    body.value[2] <= 255
  ) {
    return {
      action: "color",
      value: [body.value[0], body.value[1], body.value[2]],
    };
  }
  if (
    body.action === "color_temp" &&
    typeof body.value === "number" &&
    Number.isInteger(body.value) &&
    body.value >= 1000 &&
    body.value <= 20000
  ) {
    return { action: "color_temp", value: body.value };
  }
  return null;
}

async function getHomeAssistantLight(entityId: string) {
  const adminId = getAdminUserId();
  const connection = adminId ? getHomeAssistantCredentials(adminId) : null;
  if (!connection) {
    throw new Error("The dashboard admin has not configured Home Assistant.");
  }
  const stateUrl = new URL(connection.baseUrl);
  stateUrl.pathname = `${stateUrl.pathname.replace(/\/+$/, "")}/api/states/${encodeURIComponent(entityId)}`;
  stateUrl.search = "";
  stateUrl.hash = "";
  const state = await readJsonResponse(
    await fetch(stateUrl, {
      cache: "no-store",
      headers: { Authorization: "Bearer " + connection.token },
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    }),
  );
  const attributes = isRecord(state.attributes) ? state.attributes : {};
  const supportedModes = Array.isArray(attributes.supported_color_modes)
    ? attributes.supported_color_modes.filter(
        (mode): mode is string => typeof mode === "string",
      )
    : [];
  const supportsBrightness =
    typeof attributes.brightness === "number" ||
    supportedModes.some((mode) => mode !== "onoff");
  const supportsColor = supportedModes.some((mode) =>
    ["hs", "xy", "rgb", "rgbw", "rgbww"].includes(mode),
  );
  const supportsColorTemp =
    supportedModes.includes("color_temp") || attributes.supports_color_temp === true;
  const minMireds =
    typeof attributes.max_mireds === "number" ? attributes.max_mireds : null;
  const maxMireds =
    typeof attributes.min_mireds === "number" ? attributes.min_mireds : null;
  const minKelvin =
    typeof attributes.min_color_temp_kelvin === "number"
      ? attributes.min_color_temp_kelvin
      : minMireds
        ? Math.round(1_000_000 / minMireds)
        : 2000;
  const maxKelvin =
    typeof attributes.max_color_temp_kelvin === "number"
      ? attributes.max_color_temp_kelvin
      : maxMireds
        ? Math.round(1_000_000 / maxMireds)
        : 6500;
  const rgbColor = Array.isArray(attributes.rgb_color)
    ? attributes.rgb_color.slice(0, 3).map((channel) =>
        typeof channel === "number" ? Math.min(255, Math.max(0, Math.round(channel))) : 255,
      )
    : [255, 255, 255];

  return {
    entityId,
    state: typeof state.state === "string" ? state.state : "unknown",
    friendlyName:
      typeof attributes.friendly_name === "string"
        ? attributes.friendly_name
        : entityId,
    brightness:
      typeof attributes.brightness === "number"
        ? Math.min(255, Math.max(1, Math.round(attributes.brightness)))
        : 255,
    supportsBrightness,
    supportsColor,
    rgbColor,
    supportsColorTemp,
    minKelvin: Math.min(minKelvin, maxKelvin),
    maxKelvin: Math.max(minKelvin, maxKelvin),
    colorTempKelvin:
      typeof attributes.color_temp_kelvin === "number"
        ? attributes.color_temp_kelvin
        : Math.round((minKelvin + maxKelvin) / 2),
    lastChanged: typeof state.last_changed === "string" ? state.last_changed : "",
  };
}

async function readFanControl(request: Request): Promise<FanControl | null> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }
  if (!isRecord(body) || typeof body.action !== "string") return null;
  if (body.action === "toggle") return { action: "toggle" };
  if (
    body.action === "percentage" &&
    typeof body.value === "number" &&
    Number.isInteger(body.value) &&
    body.value >= 1 &&
    body.value <= 100
  ) {
    return { action: "percentage", value: body.value };
  }
  if (
    body.action === "direction" &&
    (body.value === "forward" || body.value === "reverse")
  ) {
    return { action: "direction", value: body.value };
  }
  return null;
}

async function getHomeAssistantFan(entityId: string) {
  const adminId = getAdminUserId();
  const connection = adminId ? getHomeAssistantCredentials(adminId) : null;
  if (!connection) {
    throw new Error("The dashboard admin has not configured Home Assistant.");
  }
  const stateUrl = new URL(connection.baseUrl);
  stateUrl.pathname = `${stateUrl.pathname.replace(/\/+$/, "")}/api/states/${encodeURIComponent(entityId)}`;
  stateUrl.search = "";
  stateUrl.hash = "";
  const state = await readJsonResponse(
    await fetch(stateUrl, {
      cache: "no-store",
      headers: { Authorization: "Bearer " + connection.token },
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    }),
  );
  const attributes = isRecord(state.attributes) ? state.attributes : {};
  const supportedFeatures =
    typeof attributes.supported_features === "number"
      ? attributes.supported_features
      : 0;
  return {
    entityId,
    state: typeof state.state === "string" ? state.state : "unknown",
    friendlyName:
      typeof attributes.friendly_name === "string"
        ? attributes.friendly_name
        : entityId,
    percentage:
      typeof attributes.percentage === "number"
        ? Math.min(100, Math.max(1, Math.round(attributes.percentage)))
        : 1,
    percentageStep:
      typeof attributes.percentage_step === "number"
        ? Math.max(1, Math.round(attributes.percentage_step))
        : 1,
    supportsDirection:
      (supportedFeatures & 4) === 4 ||
      attributes.direction === "forward" ||
      attributes.direction === "reverse",
    direction:
      attributes.direction === "reverse" ? "reverse" : "forward",
  };
}

async function getHomeAssistantThermostat(entityId: string) {
  const adminId = getAdminUserId();
  const connection = adminId ? getHomeAssistantCredentials(adminId) : null;
  if (!connection) {
    throw new Error("The dashboard admin has not configured Home Assistant.");
  }
  const stateUrl = new URL(connection.baseUrl);
  stateUrl.pathname = `${stateUrl.pathname.replace(/\/+$/, "")}/api/states/${encodeURIComponent(entityId)}`;
  stateUrl.search = "";
  stateUrl.hash = "";
  const state = await readJsonResponse(
    await fetch(stateUrl, {
      cache: "no-store",
      headers: { Authorization: "Bearer " + connection.token },
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    }),
  );
  const attributes = isRecord(state.attributes) ? state.attributes : {};
  return {
    entityId,
    state: typeof state.state === "string" ? state.state : "unknown",
    friendlyName:
      typeof attributes.friendly_name === "string"
        ? attributes.friendly_name
        : entityId,
    currentTemperature:
      typeof attributes.current_temperature === "number"
        ? attributes.current_temperature
        : null,
    temperature:
      typeof attributes.temperature === "number" ? attributes.temperature : null,
    minTemperature:
      typeof attributes.min_temp === "number" ? attributes.min_temp : 5,
    maxTemperature:
      typeof attributes.max_temp === "number" ? attributes.max_temp : 35,
    temperatureStep:
      typeof attributes.target_temp_step === "number"
        ? attributes.target_temp_step
        : 0.5,
    temperatureUnit:
      typeof attributes.temperature_unit === "string"
        ? attributes.temperature_unit
        : "°C",
    hvacModes: Array.isArray(attributes.hvac_modes)
      ? attributes.hvac_modes.filter(
          (mode): mode is string => typeof mode === "string",
        )
      : [],
    hvacAction:
      typeof attributes.hvac_action === "string" ? attributes.hvac_action : "",
  };
}

async function readThermostatControl(
  request: Request,
): Promise<ThermostatControl | null> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }
  if (!isRecord(body)) return null;
  if (
    body.action === "temperature" &&
    typeof body.value === "number" &&
    Number.isFinite(body.value) &&
    body.value >= -50 &&
    body.value <= 100
  ) {
    return { action: "temperature", value: body.value };
  }
  if (
    body.action === "hvac_mode" &&
    typeof body.value === "string" &&
    body.value.length > 0 &&
    body.value.length <= 40
  ) {
    return { action: "hvac_mode", value: body.value };
  }
  return null;
}

async function controlHomeAssistantLight(entityId: string, control: LightControl) {
  const adminId = getAdminUserId();
  const connection = adminId ? getHomeAssistantCredentials(adminId) : null;
  if (!connection) {
    throw new Error("The dashboard admin has not configured Home Assistant.");
  }

  const current = await getHomeAssistantLight(entityId);
  const data: Record<string, string | number | number[]> = { entity_id: entityId };
  let service: "turn_on" | "turn_off";
  switch (control.action) {
    case "toggle":
      service = current.state === "on" ? "turn_off" : "turn_on";
      break;
    case "brightness":
      if (!current.supportsBrightness) {
        throw new Error("This light does not support brightness control.");
      }
      service = "turn_on";
      data.brightness = control.value;
      break;
    case "color":
      if (!current.supportsColor) {
        throw new Error("This light does not support color control.");
      }
      service = "turn_on";
      data.rgb_color = control.value;
      break;
    case "color_temp":
      if (!current.supportsColorTemp) {
        throw new Error("This light does not support white temperature control.");
      }
      service = "turn_on";
      data.color_temp_kelvin = Math.min(
        current.maxKelvin,
        Math.max(current.minKelvin, control.value),
      );
      break;
  }

  const serviceUrl = new URL(connection.baseUrl);
  serviceUrl.pathname = `${serviceUrl.pathname.replace(/\/+$/, "")}/api/services/light/${service}`;
  serviceUrl.search = "";
  serviceUrl.hash = "";
  const response = await fetch(serviceUrl, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: "Bearer " + connection.token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(`Home Assistant rejected the light command (HTTP ${response.status}).`);
  }
  return getHomeAssistantLight(entityId);
}

async function controlHomeAssistantFan(entityId: string, control: FanControl) {
  const adminId = getAdminUserId();
  const connection = adminId ? getHomeAssistantCredentials(adminId) : null;
  if (!connection) {
    throw new Error("The dashboard admin has not configured Home Assistant.");
  }
  const serviceUrl = new URL(connection.baseUrl);
  let service: "turn_on" | "turn_off" | "set_percentage" | "set_direction";
  const data: Record<string, string | number> = { entity_id: entityId };
  if (control.action === "toggle") {
    const current = await getHomeAssistantFan(entityId);
    service = current.state === "on" ? "turn_off" : "turn_on";
  } else if (control.action === "direction") {
    const current = await getHomeAssistantFan(entityId);
    if (!current.supportsDirection) {
      throw new Error("This fan does not support direction control.");
    }
    service = "set_direction";
    data.direction = control.value;
  } else {
    service = "set_percentage";
    data.percentage = control.value;
  }
  serviceUrl.pathname = `${serviceUrl.pathname.replace(/\/+$/, "")}/api/services/fan/${service}`;
  serviceUrl.search = "";
  serviceUrl.hash = "";
  const response = await fetch(serviceUrl, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: "Bearer " + connection.token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(`Home Assistant rejected the fan command (HTTP ${response.status}).`);
  }
  return getHomeAssistantFan(entityId);
}

async function controlHomeAssistantThermostat(
  entityId: string,
  control: ThermostatControl,
) {
  const adminId = getAdminUserId();
  const connection = adminId ? getHomeAssistantCredentials(adminId) : null;
  if (!connection) {
    throw new Error("The dashboard admin has not configured Home Assistant.");
  }
  const current = await getHomeAssistantThermostat(entityId);
  let service: "set_temperature" | "set_hvac_mode";
  const data: Record<string, string | number> = { entity_id: entityId };
  if (control.action === "temperature") {
    const min = Math.min(current.minTemperature, current.maxTemperature);
    const max = Math.max(current.minTemperature, current.maxTemperature);
    if (control.value < min || control.value > max) {
      throw new Error("Choose a temperature supported by this thermostat.");
    }
    service = "set_temperature";
    data.temperature = control.value;
  } else {
    if (!current.hvacModes.includes(control.value)) {
      throw new Error("Choose an HVAC mode supported by this thermostat.");
    }
    service = "set_hvac_mode";
    data.hvac_mode = control.value;
  }
  const serviceUrl = new URL(connection.baseUrl);
  serviceUrl.pathname = `${serviceUrl.pathname.replace(/\/+$/, "")}/api/services/climate/${service}`;
  serviceUrl.search = "";
  serviceUrl.hash = "";
  const response = await fetch(serviceUrl, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: "Bearer " + connection.token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(`Home Assistant rejected the thermostat command (HTTP ${response.status}).`);
  }
  return getHomeAssistantThermostat(entityId);
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return Response.json({ error: "Sign in to access dashboard data." }, { status: 401 });
    }

    const { id } = await context.params;
    const card = getDashboardCard(user.id, id);
    if (!card) {
      return Response.json({ error: "Dashboard card not found." }, { status: 404 });
    }

    if (card.type === "weather") {
      const units = card.config.units === "metric" ? "metric" : "imperial";
      const forecastType =
        card.config.forecastType === "hourly" ||
        card.config.forecastType === "twice_daily"
          ? card.config.forecastType
          : "daily";
      if (card.config.provider === "home-assistant") {
        return Response.json(
          await getHomeAssistantWeather(card.config.entityId, units, forecastType),
        );
      }
      return Response.json(
        await getOpenMeteoWeather(
          card.config.location,
          units,
          forecastType === "hourly" ? "hourly" : "daily",
        ),
      );
    }
    if (card.type === "home-assistant") {
      return Response.json(
        await getHomeAssistantState(card.config.entityId),
      );
    }
    if (card.type === "home-assistant-light") {
      return Response.json(await getHomeAssistantLight(card.config.entityId));
    }
    if (card.type === "home-assistant-fan") {
      return Response.json(await getHomeAssistantFan(card.config.entityId));
    }
    if (card.type === "home-assistant-thermostat") {
      return Response.json(await getHomeAssistantThermostat(card.config.entityId));
    }
    if (card.type === "home-assistant-dashboard") {
      return Response.json({ error: "Home Assistant dashboards are embedded directly." }, { status: 400 });
    }
    return Response.json({ error: "This card does not load live data." }, { status: 400 });
  } catch (error) {
    console.error("Dashboard card data could not be loaded:", error);
    const message =
      error instanceof Error &&
      (error.message.startsWith("No matching location") ||
        error.message.startsWith("The dashboard admin") ||
        error.message.startsWith("Home Assistant"))
        ? error.message
        : "Live data is temporarily unavailable.";
    return Response.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return Response.json({ error: "Sign in to control dashboard devices." }, { status: 401 });
    }
    const { id } = await context.params;
    const card = getDashboardCard(user.id, id);
    if (
      !card ||
      (card.type !== "home-assistant-light" &&
        card.type !== "home-assistant-fan" &&
        card.type !== "home-assistant-thermostat")
    ) {
      return Response.json({ error: "Controllable Home Assistant card not found." }, { status: 404 });
    }
    if (card.type === "home-assistant-fan") {
      const control = await readFanControl(request);
      if (!control) {
        return Response.json({ error: "Choose a valid fan control value." }, { status: 400 });
      }
      return Response.json(
        await controlHomeAssistantFan(card.config.entityId, control),
      );
    }
    if (card.type === "home-assistant-thermostat") {
      const control = await readThermostatControl(request);
      if (!control) {
        return Response.json({ error: "Choose a valid thermostat control value." }, { status: 400 });
      }
      return Response.json(
        await controlHomeAssistantThermostat(card.config.entityId, control),
      );
    }
    const control = await readLightControl(request);
    if (!control) {
      return Response.json({ error: "Choose a valid light control value." }, { status: 400 });
    }
    return Response.json(
      await controlHomeAssistantLight(card.config.entityId, control),
    );
  } catch (error) {
    console.error("Home Assistant device could not be controlled:", error);
    const message =
      error instanceof Error &&
      (error.message.startsWith("The dashboard admin") ||
        error.message.startsWith("This light") ||
        error.message.startsWith("This fan") ||
        error.message.startsWith("Choose a temperature") ||
        error.message.startsWith("Choose an HVAC mode"))
        ? error.message
        : "Unable to control this Home Assistant device right now.";
    return Response.json(
      { error: message },
      {
        status:
          message.startsWith("This light") ||
          message.startsWith("This fan") ||
          message.startsWith("Choose a temperature") ||
          message.startsWith("Choose an HVAC mode")
            ? 400
            : 502,
      },
    );
  }
}
