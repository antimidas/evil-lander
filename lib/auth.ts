import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { cookies } from "next/headers";

export type AuthUser = {
  id: string;
  email: string;
  role: "admin" | "user";
};

export type AuthCredentials = {
  email: string;
  password: string;
};

const SESSION_COOKIE = "lander_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;
const PASSWORD_HASH_BYTES = 64;
const PASSWORD_SALT_BYTES = 16;

type StoredUser = AuthUser & {
  passwordSalt: string;
  passwordHash: string;
};

let database: DatabaseSync | undefined;

export function getDatabase() {
  if (database) return database;

  const databasePath =
    process.env.AUTH_DB_PATH ?? join(process.cwd(), ".data", "auth.sqlite");
  mkdirSync(dirname(databasePath), { recursive: true });

  database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS dashboard_widgets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS dashboard_widgets_user_id_idx
      ON dashboard_widgets(user_id);

    CREATE TABLE IF NOT EXISTS dashboard_links (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS dashboard_links_user_id_idx
      ON dashboard_links(user_id);

    CREATE TABLE IF NOT EXISTS dashboards (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('desktop', 'iframe')),
      iframe_url TEXT,
      position INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dashboard_sections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      dashboard_id TEXT REFERENCES dashboards(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      position INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS dashboard_sections_user_position_idx
      ON dashboard_sections(user_id, position);
    CREATE INDEX IF NOT EXISTS dashboards_user_position_idx
      ON dashboards(user_id, position);

    CREATE TABLE IF NOT EXISTS dashboard_cards (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      section_id TEXT NOT NULL REFERENCES dashboard_sections(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (
        type IN (
          'markdown', 'link', 'button', 'image', 'embed', 'weather',
          'home-assistant', 'home-assistant-light', 'home-assistant-fan',
          'home-assistant-thermostat', 'home-assistant-dashboard', 'clock', 'calendar'
        )
      ),
      title TEXT NOT NULL,
      config_json TEXT NOT NULL,
      position INTEGER NOT NULL,
      col_span INTEGER NOT NULL DEFAULT 1 CHECK (col_span BETWEEN 1 AND 4),
      row_span INTEGER NOT NULL DEFAULT 1 CHECK (row_span BETWEEN 1 AND 3),
      float_x REAL NOT NULL DEFAULT 2,
      float_y INTEGER NOT NULL DEFAULT 2,
      float_width REAL NOT NULL DEFAULT 30,
      float_height INTEGER NOT NULL DEFAULT 320,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS dashboard_cards_user_section_position_idx
      ON dashboard_cards(user_id, section_id, position);

    CREATE TABLE IF NOT EXISTS dashboard_preferences (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      layout TEXT NOT NULL DEFAULT 'grid' CHECK (layout IN ('grid', 'masonry', 'list', 'floating'))
    );

    CREATE TABLE IF NOT EXISTS home_assistant_connections (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      base_url TEXT NOT NULL,
      token_ciphertext TEXT NOT NULL,
      token_iv TEXT NOT NULL,
      token_tag TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS landing_page_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      logo_data_url TEXT,
      logo_x REAL NOT NULL DEFAULT 50 CHECK (logo_x BETWEEN 0 AND 100),
      logo_y REAL NOT NULL DEFAULT 24 CHECK (logo_y BETWEEN 0 AND 100),
      welcome_enabled INTEGER NOT NULL DEFAULT 0 CHECK (welcome_enabled IN (0, 1)),
      welcome_text TEXT NOT NULL DEFAULT '',
      welcome_x REAL NOT NULL DEFAULT 50 CHECK (welcome_x BETWEEN 0 AND 100),
      welcome_y REAL NOT NULL DEFAULT 50 CHECK (welcome_y BETWEEN 0 AND 100),
      updated_at INTEGER NOT NULL
    );
  `);

  const sectionColumns = new Set(
    database
      .prepare("PRAGMA table_info(dashboard_sections)")
      .all()
      .map((column) => column.name),
  );
  if (!sectionColumns.has("dashboard_id")) {
    database.exec(
      "ALTER TABLE dashboard_sections ADD COLUMN dashboard_id TEXT REFERENCES dashboards(id) ON DELETE CASCADE",
    );
  }

  const originalCardColumns = new Set(
    database
      .prepare("PRAGMA table_info(dashboard_cards)")
      .all()
      .map((column) => column.name),
  );
  if (!originalCardColumns.has("float_x")) {
    database.exec(
      "ALTER TABLE dashboard_cards ADD COLUMN float_x REAL NOT NULL DEFAULT 2",
    );
  }
  if (!originalCardColumns.has("float_y")) {
    database.exec(
      "ALTER TABLE dashboard_cards ADD COLUMN float_y INTEGER NOT NULL DEFAULT 2",
    );
  }
  if (!originalCardColumns.has("float_width")) {
    database.exec(
      "ALTER TABLE dashboard_cards ADD COLUMN float_width REAL NOT NULL DEFAULT 30",
    );
  }
  if (!originalCardColumns.has("float_height")) {
    database.exec(
      "ALTER TABLE dashboard_cards ADD COLUMN float_height INTEGER NOT NULL DEFAULT 320",
    );
  }
  if (!originalCardColumns.has("float_x")) {
    database.exec(`
      UPDATE dashboard_cards
      SET float_x = 2 + (
            SELECT COUNT(*) % 3
            FROM dashboard_cards AS prior_card
            WHERE prior_card.user_id = dashboard_cards.user_id
              AND prior_card.section_id = dashboard_cards.section_id
              AND (
                prior_card.position < dashboard_cards.position
                OR (
                  prior_card.position = dashboard_cards.position
                  AND prior_card.created_at < dashboard_cards.created_at
                )
                OR (
                  prior_card.position = dashboard_cards.position
                  AND prior_card.created_at = dashboard_cards.created_at
                  AND prior_card.id < dashboard_cards.id
                )
              )
          ) * 32,
          float_y = 2 + CAST((
            SELECT COUNT(*) / 3
            FROM dashboard_cards AS prior_card
            WHERE prior_card.user_id = dashboard_cards.user_id
              AND prior_card.section_id = dashboard_cards.section_id
              AND (
                prior_card.position < dashboard_cards.position
                OR (
                  prior_card.position = dashboard_cards.position
                  AND prior_card.created_at < dashboard_cards.created_at
                )
                OR (
                  prior_card.position = dashboard_cards.position
                  AND prior_card.created_at = dashboard_cards.created_at
                  AND prior_card.id < dashboard_cards.id
                )
              )
          ) AS INTEGER) * 340;
    `);
  }

  const dashboardCardsSchema = database
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'dashboard_cards'",
    )
    .get();
  if (
    typeof dashboardCardsSchema?.sql === "string" &&
    (!dashboardCardsSchema.sql.includes("'button'") ||
    !dashboardCardsSchema.sql.includes("'home-assistant-light'") ||
    !dashboardCardsSchema.sql.includes("'home-assistant-fan'") ||
    !dashboardCardsSchema.sql.includes("'home-assistant-thermostat'") ||
    !dashboardCardsSchema.sql.includes("'home-assistant-dashboard'") ||
    !dashboardCardsSchema.sql.includes("'clock'") ||
    !dashboardCardsSchema.sql.includes("'calendar'"))
  ) {
    database.exec(`
      BEGIN IMMEDIATE;
      CREATE TABLE dashboard_cards_migrated (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        section_id TEXT NOT NULL REFERENCES dashboard_sections(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (
          type IN (
            'markdown', 'link', 'button', 'image', 'embed', 'weather',
            'home-assistant', 'home-assistant-light', 'home-assistant-fan',
            'home-assistant-thermostat', 'home-assistant-dashboard', 'clock', 'calendar'
          )
        ),
        title TEXT NOT NULL,
        config_json TEXT NOT NULL,
        position INTEGER NOT NULL,
        col_span INTEGER NOT NULL DEFAULT 1 CHECK (col_span BETWEEN 1 AND 4),
        row_span INTEGER NOT NULL DEFAULT 1 CHECK (row_span BETWEEN 1 AND 3),
        float_x REAL NOT NULL DEFAULT 2,
        float_y INTEGER NOT NULL DEFAULT 2,
        float_width REAL NOT NULL DEFAULT 30,
        float_height INTEGER NOT NULL DEFAULT 320,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      INSERT INTO dashboard_cards_migrated
        (id, user_id, section_id, type, title, config_json, position, col_span, row_span, float_x, float_y, float_width, float_height, created_at, updated_at)
      SELECT id, user_id, section_id, type, title, config_json, position, col_span, row_span, float_x, float_y, float_width, float_height, created_at, updated_at
      FROM dashboard_cards;
      DROP TABLE dashboard_cards;
      ALTER TABLE dashboard_cards_migrated RENAME TO dashboard_cards;
      CREATE INDEX dashboard_cards_user_section_position_idx
        ON dashboard_cards(user_id, section_id, position);
      COMMIT;
    `);
  }

  const preferencesSchema = database
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'dashboard_preferences'",
    )
    .get();
  if (
    typeof preferencesSchema?.sql === "string" &&
    !preferencesSchema.sql.includes("'floating'")
  ) {
    database.exec(`
      BEGIN IMMEDIATE;
      CREATE TABLE dashboard_preferences_migrated (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        layout TEXT NOT NULL DEFAULT 'grid'
          CHECK (layout IN ('grid', 'masonry', 'list', 'floating'))
      );
      INSERT INTO dashboard_preferences_migrated (user_id, layout)
        SELECT user_id, layout FROM dashboard_preferences;
      DROP TABLE dashboard_preferences;
      ALTER TABLE dashboard_preferences_migrated RENAME TO dashboard_preferences;
      COMMIT;
    `);
  }

  return database;
}

function hashPassword(password: string, salt: string) {
  return new Promise<Buffer>((resolveHash, rejectHash) => {
    scrypt(password, salt, PASSWORD_HASH_BYTES, (error, key) => {
      if (error) {
        rejectHash(error);
        return;
      }
      resolveHash(key);
    });
  });
}

function mapAuthUser(row: Record<string, unknown> | undefined): AuthUser | null {
  if (
    !row ||
    typeof row.id !== "string" ||
    typeof row.email !== "string" ||
    (row.role !== "admin" && row.role !== "user")
  ) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    role: row.role,
  };
}

function mapStoredUser(row: Record<string, unknown> | undefined): StoredUser | null {
  const user = mapAuthUser(row);
  if (
    !user ||
    typeof row?.password_salt !== "string" ||
    typeof row.password_hash !== "string"
  ) {
    return null;
  }

  return {
    ...user,
    passwordSalt: row.password_salt,
    passwordHash: row.password_hash,
  };
}

function publicUser(user: StoredUser): AuthUser {
  return { id: user.id, email: user.email, role: user.role };
}

export async function readCredentials(request: Request): Promise<AuthCredentials | null> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return null;
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    !("email" in payload) ||
    !("password" in payload) ||
    typeof payload.email !== "string" ||
    typeof payload.password !== "string"
  ) {
    return null;
  }

  const email = payload.email.trim().toLowerCase();
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    payload.password.length === 0 ||
    payload.password.length > 128
  ) {
    return null;
  }

  return { email, password: payload.password };
}

export async function createAccount(email: string, password: string) {
  const salt = randomBytes(PASSWORD_SALT_BYTES).toString("hex");
  const passwordHash = await hashPassword(password, salt);
  const id = randomUUID();
  const db = getDatabase();

  let transactionOpen = false;
  try {
    db.exec("BEGIN IMMEDIATE");
    transactionOpen = true;

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      db.exec("ROLLBACK");
      transactionOpen = false;
      return null;
    }

    const countRow = db.prepare("SELECT COUNT(*) AS count FROM users").get();
    const role = Number(countRow?.count) === 0 ? "admin" : "user";

    db.prepare(
      `INSERT INTO users (id, email, password_salt, password_hash, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, email, salt, passwordHash.toString("hex"), role, Date.now());

    db.exec("COMMIT");
    transactionOpen = false;
    return { id, email, role } satisfies AuthUser;
  } catch (error) {
    if (transactionOpen) db.exec("ROLLBACK");
    throw error;
  }
}

export async function verifyCredentials(email: string, password: string) {
  const row = getDatabase()
    .prepare(
      `SELECT id, email, password_salt, password_hash, role
       FROM users WHERE email = ?`,
    )
    .get(email);
  const user = mapStoredUser(row);
  if (!user) return null;

  const passwordHash = await hashPassword(password, user.passwordSalt);
  const storedHash = Buffer.from(user.passwordHash, "hex");
  if (
    storedHash.length !== passwordHash.length ||
    !timingSafeEqual(storedHash, passwordHash)
  ) {
    return null;
  }

  return publicUser(user);
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createSession(user: AuthUser) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + SESSION_DURATION_SECONDS * 1000;
  const db = getDatabase();

  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
  db.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
  ).run(tokenHash(token), user.id, expiresAt);

  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: number) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    expires: new Date(expiresAt),
    httpOnly: true,
    maxAge: SESSION_DURATION_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT users.id, users.email, users.role, sessions.expires_at
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ?`,
    )
    .get(tokenHash(token));

  if (!row || typeof row.expires_at !== "number" || row.expires_at <= Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
    return null;
  }

  return mapAuthUser(row);
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    getDatabase()
      .prepare("DELETE FROM sessions WHERE token_hash = ?")
      .run(tokenHash(token));
  }

  cookieStore.delete(SESSION_COOKIE);
}
