import { randomBytes, randomUUID, scrypt } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!email || !password) {
  console.error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
  process.exit(1);
}

const databasePath = process.env.AUTH_DB_PATH ?? join(process.cwd(), ".data", "auth.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });
const db = new DatabaseSync(databasePath);
db.exec(`
  PRAGMA busy_timeout = 5000;
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    created_at INTEGER NOT NULL
  );
`);

if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
  console.log(`User ${email} already exists; leaving it unchanged.`);
  process.exit(0);
}

const salt = randomBytes(16).toString("hex");
const hash = await new Promise((resolve, reject) =>
  scrypt(password, salt, 64, (error, key) => (error ? reject(error) : resolve(key))),
);
db.prepare(
  `INSERT INTO users (id, email, password_salt, password_hash, role, created_at)
   VALUES (?, ?, ?, ?, 'admin', ?)`,
).run(randomUUID(), email, salt, hash.toString("hex"), Date.now());
console.log(`Created admin user ${email}.`);
