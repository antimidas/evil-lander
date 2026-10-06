import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { getDatabase } from "@/lib/auth";

export const dashboardLayouts = ["grid", "masonry", "list", "floating"] as const;
export type DashboardLayout = (typeof dashboardLayouts)[number];

export const dashboardCardTypes = [
  "markdown",
  "link",
  "button",
  "image",
  "embed",
  "weather",
  "home-assistant",
  "home-assistant-light",
  "home-assistant-fan",
  "home-assistant-thermostat",
  "home-assistant-dashboard",
  "clock",
  "calendar",
] as const;
export type DashboardCardType = (typeof dashboardCardTypes)[number];

export type DashboardSection = {
  id: string;
  dashboardId: string;
  title: string;
  position: number;
};

export type DashboardPage = {
  id: string;
  title: string;
  kind: "desktop" | "iframe";
  iframeUrl: string | null;
  position: number;
};

export type DashboardCard = {
  id: string;
  sectionId: string;
  type: DashboardCardType;
  title: string;
  config: Record<string, string>;
  position: number;
  colSpan: number;
  rowSpan: number;
  floatX: number;
  floatY: number;
  floatWidth: number;
  floatHeight: number;
};

export type DashboardCardInput = Omit<DashboardCard, "id" | "position">;

type DatabaseRow = Record<string, unknown>;

function isDashboardCardType(value: unknown): value is DashboardCardType {
  return typeof value === "string" && dashboardCardTypes.some((type) => type === value);
}

function isDashboardLayout(value: unknown): value is DashboardLayout {
  return typeof value === "string" && dashboardLayouts.some((layout) => layout === value);
}

function parseCardConfig(value: unknown): Record<string, string> {
  if (typeof value !== "string") throw new Error("Invalid dashboard card config.");
  const parsed: unknown = JSON.parse(value);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed) ||
    !Object.values(parsed).every((item) => typeof item === "string")
  ) {
    throw new Error("Invalid dashboard card config.");
  }
  const config: Record<string, string> = {};
  for (const [key, item] of Object.entries(parsed)) {
    if (typeof item !== "string") throw new Error("Invalid dashboard card config.");
    config[key] = item;
  }
  return config;
}

function mapSection(row: DatabaseRow): DashboardSection {
  if (
    typeof row.id !== "string" ||
    typeof row.dashboard_id !== "string" ||
    typeof row.title !== "string" ||
    typeof row.position !== "number"
  ) {
    throw new Error("Invalid dashboard section record.");
  }
  return {
    id: row.id,
    dashboardId: row.dashboard_id,
    title: row.title,
    position: row.position,
  };
}

function mapDashboard(row: DatabaseRow): DashboardPage {
  if (
    typeof row.id !== "string" ||
    typeof row.title !== "string" ||
    (row.kind !== "desktop" && row.kind !== "iframe") ||
    (row.iframe_url !== null && typeof row.iframe_url !== "string") ||
    typeof row.position !== "number"
  ) {
    throw new Error("Invalid dashboard record.");
  }
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    iframeUrl: row.iframe_url,
    position: row.position,
  };
}

function mapCard(row: DatabaseRow): DashboardCard {
  if (
    typeof row.id !== "string" ||
    typeof row.section_id !== "string" ||
    !isDashboardCardType(row.type) ||
    typeof row.title !== "string" ||
    typeof row.position !== "number" ||
    typeof row.col_span !== "number" ||
    typeof row.row_span !== "number" ||
    typeof row.float_x !== "number" ||
    typeof row.float_y !== "number" ||
    typeof row.float_width !== "number" ||
    typeof row.float_height !== "number"
  ) {
    throw new Error("Invalid dashboard card record.");
  }
  return {
    id: row.id,
    sectionId: row.section_id,
    type: row.type,
    title: row.title,
    config: parseCardConfig(row.config_json),
    position: row.position,
    colSpan: row.col_span,
    rowSpan: row.row_span,
    floatX: row.float_x,
    floatY: row.float_y,
    floatWidth: row.float_width,
    floatHeight: row.float_height,
  };
}

function ensureDashboard(userId: string) {
  const db = getDatabase();
  db.prepare(
    "INSERT OR IGNORE INTO dashboard_preferences (user_id, layout) VALUES (?, 'grid')",
  ).run(userId);
  let dashboard = db
    .prepare("SELECT id FROM dashboards WHERE user_id = ? ORDER BY position, created_at LIMIT 1")
    .get(userId);
  if (!dashboard) {
    const id = randomUUID();
    const now = Date.now();
    db.prepare(
      `INSERT INTO dashboards (id, user_id, title, kind, iframe_url, position, created_at, updated_at)
       VALUES (?, ?, 'Home', 'desktop', NULL, 0, ?, ?)`,
    ).run(id, userId, now, now);
    dashboard = { id };
  }
  const dashboardId = dashboard.id;
  db.prepare(
    "UPDATE dashboard_sections SET dashboard_id = ? WHERE user_id = ? AND dashboard_id IS NULL",
  ).run(dashboardId, userId);
  let section = db
    .prepare(
      "SELECT id FROM dashboard_sections WHERE user_id = ? AND dashboard_id = ? ORDER BY position LIMIT 1",
    )
    .get(userId, dashboardId);
  if (!section) {
    const id = randomUUID();
    const now = Date.now();
    db.prepare(
      `INSERT INTO dashboard_sections (id, user_id, dashboard_id, title, position, created_at, updated_at)
       VALUES (?, ?, ?, 'Overview', 0, ?, ?)`,
    ).run(id, userId, dashboardId, now, now);
    section = { id };
  }

  const sectionId = section.id;
  db.prepare(
    `INSERT OR IGNORE INTO dashboard_cards
     (id, user_id, section_id, type, title, config_json, position, col_span, row_span,
      float_x, float_y, float_width, float_height, created_at, updated_at)
     SELECT id, user_id, ?, 'markdown', title, json_object('markdown', content),
            (SELECT COUNT(*) FROM dashboard_cards WHERE user_id = dashboard_widgets.user_id),
            1, 1,
            2 + ((SELECT COUNT(*) FROM dashboard_cards WHERE user_id = dashboard_widgets.user_id) % 3) * 32,
            2 + CAST((SELECT COUNT(*) FROM dashboard_cards WHERE user_id = dashboard_widgets.user_id) / 3 AS INTEGER) * 340,
            30, 320, created_at, updated_at
     FROM dashboard_widgets
     WHERE user_id = ?`,
  ).run(sectionId, userId);
  db.prepare(
    `INSERT OR IGNORE INTO dashboard_cards
     (id, user_id, section_id, type, title, config_json, position, col_span, row_span,
      float_x, float_y, float_width, float_height, created_at, updated_at)
     SELECT id, user_id, ?, 'link', title,
            json_object('url', url, 'description', description),
            (SELECT COUNT(*) FROM dashboard_cards WHERE user_id = dashboard_links.user_id),
            1, 1,
            2 + ((SELECT COUNT(*) FROM dashboard_cards WHERE user_id = dashboard_links.user_id) % 3) * 32,
            2 + CAST((SELECT COUNT(*) FROM dashboard_cards WHERE user_id = dashboard_links.user_id) / 3 AS INTEGER) * 340,
            30, 320, created_at, updated_at
     FROM dashboard_links
     WHERE user_id = ?`,
  ).run(sectionId, userId);
}

export function getDashboard(userId: string) {
  ensureDashboard(userId);
  const db = getDatabase();
  const preference = db
    .prepare("SELECT layout FROM dashboard_preferences WHERE user_id = ?")
    .get(userId);
  if (
    !isDashboardLayout(preference?.layout)
  ) {
    throw new Error("Invalid dashboard layout preference.");
  }

  const sections = db
    .prepare(
      `SELECT id, dashboard_id, title, position FROM dashboard_sections
       WHERE user_id = ? ORDER BY position, created_at`,
    )
    .all(userId)
    .map(mapSection);
  const dashboards = db
    .prepare(
      `SELECT id, title, kind, iframe_url, position FROM dashboards
       WHERE user_id = ? ORDER BY position, created_at`,
    )
    .all(userId)
    .map(mapDashboard);
  const cards = db
    .prepare(
      `SELECT id, section_id, type, title, config_json, position, col_span, row_span,
              float_x, float_y, float_width, float_height
       FROM dashboard_cards WHERE user_id = ? ORDER BY section_id, position, created_at`,
    )
    .all(userId)
    .map(mapCard);
  const adminId = getAdminUserId();
  const connection = adminId
    ? db
        .prepare("SELECT base_url FROM home_assistant_connections WHERE user_id = ?")
        .get(adminId)
    : null;

  return {
    layout: preference.layout,
    dashboards,
    sections,
    cards,
    homeAssistantConfigured: typeof connection?.base_url === "string",
    homeAssistantBaseUrl:
      typeof connection?.base_url === "string" ? connection.base_url : "",
  };
}

export function createDashboard(
  userId: string,
  input: { title: string; kind: "desktop" | "iframe"; iframeUrl?: string },
) {
  ensureDashboard(userId);
  const db = getDatabase();
  const id = randomUUID();
  const now = Date.now();
  const position = Number(
    db
      .prepare(
        "SELECT COALESCE(MAX(position), -1) + 1 AS position FROM dashboards WHERE user_id = ?",
      )
      .get(userId)?.position ?? 0,
  );
  db.prepare(
    `INSERT INTO dashboards (id, user_id, title, kind, iframe_url, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, userId, input.title, input.kind, input.iframeUrl ?? null, position, now, now);
  if (input.kind === "desktop") {
    const sectionId = randomUUID();
    db.prepare(
      `INSERT INTO dashboard_sections (id, user_id, dashboard_id, title, position, created_at, updated_at)
       VALUES (?, ?, ?, 'Overview', 0, ?, ?)`,
    ).run(sectionId, userId, id, now, now);
  }
  return {
    id,
    title: input.title,
    kind: input.kind,
    iframeUrl: input.iframeUrl ?? null,
    position,
  } satisfies DashboardPage;
}

export function deleteDashboard(userId: string, id: string) {
  const db = getDatabase();
  db.exec("BEGIN IMMEDIATE");
  try {
    const dashboards = db
      .prepare("SELECT id FROM dashboards WHERE user_id = ?")
      .all(userId);
    if (!dashboards.some((dashboard) => dashboard.id === id)) {
      db.exec("ROLLBACK");
      return "not-found" as const;
    }
    if (dashboards.length <= 1) {
      db.exec("ROLLBACK");
      return "last-dashboard" as const;
    }
    db.prepare("DELETE FROM dashboards WHERE id = ? AND user_id = ?").run(id, userId);
    db.exec("COMMIT");
    return "deleted" as const;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function getAdminUserId() {
  const row = getDatabase()
    .prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1")
    .get();
  return typeof row?.id === "string" ? row.id : null;
}

export function updateDashboardLayout(userId: string, layout: DashboardLayout) {
  ensureDashboard(userId);
  getDatabase()
    .prepare("UPDATE dashboard_preferences SET layout = ? WHERE user_id = ?")
    .run(layout, userId);
}

export function createSection(userId: string, title: string) {
  ensureDashboard(userId);
  const db = getDatabase();
  const dashboardId = db
    .prepare(
      "SELECT id FROM dashboards WHERE user_id = ? ORDER BY position, created_at LIMIT 1",
    )
    .get(userId)?.id;
  if (typeof dashboardId !== "string") throw new Error("Dashboard not found.");
  const id = randomUUID();
  const row = db
    .prepare(
      "SELECT COALESCE(MAX(position), -1) + 1 AS position FROM dashboard_sections WHERE user_id = ?",
    )
    .get(userId);
  const position = Number(row?.position ?? 0);
  db.prepare(
    `INSERT INTO dashboard_sections (id, user_id, dashboard_id, title, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, userId, dashboardId, title, position, Date.now(), Date.now());
  return { id, dashboardId, title, position } satisfies DashboardSection;
}

export function updateSection(userId: string, id: string, title: string) {
  const db = getDatabase();
  db.prepare(
    "UPDATE dashboard_sections SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?",
  ).run(title, Date.now(), id, userId);
  const row = db
    .prepare(
      "SELECT id, dashboard_id, title, position FROM dashboard_sections WHERE id = ? AND user_id = ?",
    )
    .get(id, userId);
  return row ? mapSection(row) : null;
}

export function deleteSection(userId: string, id: string) {
  const db = getDatabase();
  const sections = db
    .prepare("SELECT id FROM dashboard_sections WHERE user_id = ? ORDER BY position")
    .all(userId);
  if (sections.length <= 1) return "last-section" as const;
  const deleted = db
    .prepare("DELETE FROM dashboard_sections WHERE id = ? AND user_id = ?")
    .run(id, userId);
  return deleted.changes > 0 ? "deleted" as const : "not-found" as const;
}

export function reorderSections(userId: string, sectionIds: string[]) {
  const db = getDatabase();
  const owned = db
    .prepare("SELECT id FROM dashboard_sections WHERE user_id = ?")
    .all(userId)
    .map((row) => row.id);
  if (
    owned.length !== sectionIds.length ||
    new Set(sectionIds).size !== sectionIds.length ||
    !owned.every((id) => typeof id === "string" && sectionIds.includes(id))
  ) {
    return false;
  }
  const update = db.prepare(
    "UPDATE dashboard_sections SET position = ?, updated_at = ? WHERE id = ? AND user_id = ?",
  );
  const now = Date.now();
  db.exec("BEGIN IMMEDIATE");
  try {
    sectionIds.forEach((id, position) => update.run(position, now, id, userId));
    db.exec("COMMIT");
    return true;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function createCard(userId: string, input: DashboardCardInput) {
  ensureDashboard(userId);
  const db = getDatabase();
  const section = db
    .prepare("SELECT id FROM dashboard_sections WHERE id = ? AND user_id = ?")
    .get(input.sectionId, userId);
  if (!section) return null;

  const positionRow = db
    .prepare(
      "SELECT COALESCE(MAX(position), -1) + 1 AS position FROM dashboard_cards WHERE section_id = ? AND user_id = ?",
    )
    .get(input.sectionId, userId);
  const position = Number(positionRow?.position ?? 0);
  const id = randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO dashboard_cards
     (id, user_id, section_id, type, title, config_json, position, col_span, row_span,
      float_x, float_y, float_width, float_height, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    userId,
    input.sectionId,
    input.type,
    input.title,
    JSON.stringify(input.config),
    position,
    input.colSpan,
    input.rowSpan,
    input.floatX,
    input.floatY,
    input.floatWidth,
    input.floatHeight,
    now,
    now,
  );
  return { ...input, id, position } satisfies DashboardCard;
}

export function updateCard(userId: string, id: string, input: DashboardCardInput) {
  const db = getDatabase();
  const section = db
    .prepare("SELECT id FROM dashboard_sections WHERE id = ? AND user_id = ?")
    .get(input.sectionId, userId);
  if (!section) return null;
  const existing = db
    .prepare(
      `SELECT section_id, position, float_x, float_y, float_width, float_height
       FROM dashboard_cards WHERE id = ? AND user_id = ?`,
    )
    .get(id, userId);
  if (!existing) return null;
  const position =
    existing.section_id === input.sectionId
      ? Number(existing.position)
      : Number(
          db
            .prepare(
              "SELECT COALESCE(MAX(position), -1) + 1 AS position FROM dashboard_cards WHERE section_id = ? AND user_id = ?",
            )
            .get(input.sectionId, userId)?.position ?? 0,
        );

  db.prepare(
    `UPDATE dashboard_cards
     SET section_id = ?, type = ?, title = ?, config_json = ?, col_span = ?,
         row_span = ?, position = ?, float_x = ?, float_y = ?, float_width = ?,
         float_height = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
  ).run(
    input.sectionId,
    input.type,
    input.title,
    JSON.stringify(input.config),
    input.colSpan,
    input.rowSpan,
    position,
    input.floatX,
    input.floatY,
    input.floatWidth,
    input.floatHeight,
    Date.now(),
    id,
    userId,
  );
  return { ...input, id, position } satisfies DashboardCard;
}

export function getDashboardCard(userId: string, id: string): DashboardCard | null {
  const row = getDatabase()
    .prepare(
      `SELECT id, section_id, type, title, config_json, position, col_span, row_span,
              float_x, float_y, float_width, float_height
       FROM dashboard_cards WHERE id = ? AND user_id = ?`,
    )
    .get(id, userId);
  return row ? mapCard(row) : null;
}

export function deleteCard(userId: string, id: string) {
  return (
    getDatabase()
      .prepare("DELETE FROM dashboard_cards WHERE id = ? AND user_id = ?")
      .run(id, userId).changes > 0
  );
}

export function reorderCards(userId: string, sectionId: string, cardIds: string[]) {
  const db = getDatabase();
  const owned = db
    .prepare(
      "SELECT id FROM dashboard_cards WHERE user_id = ? AND section_id = ?",
    )
    .all(userId, sectionId)
    .map((row) => row.id);
  if (
    owned.length !== cardIds.length ||
    new Set(cardIds).size !== cardIds.length ||
    !owned.every((id) => typeof id === "string" && cardIds.includes(id))
  ) {
    return false;
  }
  const update = db.prepare(
    "UPDATE dashboard_cards SET position = ?, updated_at = ? WHERE id = ? AND user_id = ?",
  );
  const now = Date.now();
  db.exec("BEGIN IMMEDIATE");
  try {
    cardIds.forEach((id, position) => update.run(position, now, id, userId));
    db.exec("COMMIT");
    return true;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function encryptionKey() {
  const key = process.env.AUTH_ENCRYPTION_KEY;
  if (!key || !/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("AUTH_ENCRYPTION_KEY must be set to a 32-byte hexadecimal key.");
  }
  return Buffer.from(key, "hex");
}

function encryptToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  return {
    ciphertext: ciphertext.toString("hex"),
    iv: iv.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
  };
}

function decryptToken(row: DatabaseRow) {
  if (
    typeof row.token_ciphertext !== "string" ||
    typeof row.token_iv !== "string" ||
    typeof row.token_tag !== "string"
  ) {
    throw new Error("Invalid Home Assistant connection record.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(row.token_iv, "hex"),
  );
  decipher.setAuthTag(Buffer.from(row.token_tag, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(row.token_ciphertext, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

export function getHomeAssistantSettings(userId: string) {
  const row = getDatabase()
    .prepare(
      `SELECT base_url FROM home_assistant_connections WHERE user_id = ?`,
    )
    .get(userId);
  return {
    baseUrl: typeof row?.base_url === "string" ? row.base_url : "",
    configured: typeof row?.base_url === "string",
  };
}

export function saveHomeAssistantSettings(
  userId: string,
  baseUrl: string,
  token: string | undefined,
) {
  const db = getDatabase();
  const existing = db
    .prepare(
      "SELECT token_ciphertext, token_iv, token_tag FROM home_assistant_connections WHERE user_id = ?",
    )
    .get(userId);
  if (!token && !existing) {
    throw new Error("Enter a Home Assistant long-lived access token.");
  }

  const encrypted = token ? encryptToken(token) : null;
  const timestamp = Date.now();
  if (encrypted) {
    db.prepare(
      `INSERT INTO home_assistant_connections
       (user_id, base_url, token_ciphertext, token_iv, token_tag, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         base_url = excluded.base_url,
         token_ciphertext = excluded.token_ciphertext,
         token_iv = excluded.token_iv,
         token_tag = excluded.token_tag,
         updated_at = excluded.updated_at`,
    ).run(
      userId,
      baseUrl,
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.tag,
      timestamp,
    );
  } else {
    db.prepare(
      "UPDATE home_assistant_connections SET base_url = ?, updated_at = ? WHERE user_id = ?",
    ).run(baseUrl, timestamp, userId);
  }
}

export function getHomeAssistantCredentials(userId: string) {
  const row = getDatabase()
    .prepare(
      `SELECT base_url, token_ciphertext, token_iv, token_tag
       FROM home_assistant_connections WHERE user_id = ?`,
    )
    .get(userId);
  if (!row || typeof row.base_url !== "string") return null;
  return { baseUrl: row.base_url, token: decryptToken(row) };
}
