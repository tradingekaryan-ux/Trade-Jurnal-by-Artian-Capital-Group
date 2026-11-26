import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";

/** Schema for the single global database (users, sessions, quota, models, promos). */
export const SYSTEM_BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  username_normalized TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL,
  last_login_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username_normalized);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS login_attempts (
  key TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  first_failure_at TEXT NOT NULL,
  last_failure_at TEXT NOT NULL,
  blocked_until TEXT
);

CREATE TABLE IF NOT EXISTS ai_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ai_usage_user_day ON ai_usage (user_id, day);

CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'paid',
  context_length INTEGER,
  supports_pdf INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'openrouter',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS global_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS promos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'promo',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_data BLOB,
  image_mime TEXT,
  image_name TEXT,
  promo_code TEXT,
  code_enabled INTEGER NOT NULL DEFAULT 0,
  url TEXT,
  url_enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS promos_user ON promos (user_id);
CREATE INDEX IF NOT EXISTS promos_created ON promos (created_at);

CREATE TABLE IF NOT EXISTS promo_votes (
  id TEXT PRIMARY KEY,
  promo_id TEXT NOT NULL REFERENCES promos(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS promo_vote_unique ON promo_votes (promo_id, user_id);
CREATE INDEX IF NOT EXISTS promo_votes_promo ON promo_votes (promo_id);
`;

const hasColumn = (sqlite: Database.Database, table: string, column: string) =>
  (sqlite.pragma(`table_info(${table})`) as { name: string }[]).some((row) => row.name === column);

const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
};

/** Provision a dedicated owner account. Credentials are written to the data directory. */
function ensureOwner(sqlite: Database.Database, file: string) {
  const credentialsPath = join(dirname(file), "owner-credentials.txt");
  let fileUsername = "";
  let filePassword = "";
  if (existsSync(credentialsPath)) {
    const lines = readFileSync(credentialsPath, "utf8").split("\n");
    fileUsername =
      lines
        .find((line) => line.startsWith("username:"))
        ?.replace("username:", "")
        .trim() ?? "";
    filePassword =
      lines
        .find((line) => line.startsWith("password:"))
        ?.replace("password:", "")
        .trim() ?? "";
  }
  const username = process.env.OWNER_USERNAME?.trim() || fileUsername || "owner";
  const normalized = username.toLowerCase();
  const found = sqlite
    .prepare("SELECT id FROM users WHERE username_normalized = ?")
    .get(normalized);
  if (found) return;

  let password = process.env.OWNER_PASSWORD?.trim() || filePassword;
  if (!password) {
    password = randomBytes(12).toString("base64url");
    writeFileSync(credentialsPath, `username: ${username}\npassword: ${password}\n`, {
      mode: 0o600,
    });
    console.log(`[owner] Akun owner dibuat. Kredensial: ${credentialsPath}`);
  }

  sqlite
    .prepare(
      `INSERT INTO users (id, username, username_normalized, password_hash, is_admin, role, created_at)
       VALUES (?, ?, ?, ?, 1, 'owner', ?)`,
    )
    .run(
      randomBytes(16).toString("hex"),
      username,
      normalized,
      hashPassword(password),
      new Date().toISOString(),
    );
}

export function openSystemDatabase(file: string): Database.Database {
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(SYSTEM_BOOTSTRAP_SQL);
  if (!hasColumn(sqlite, "promos", "kind")) {
    sqlite.exec("ALTER TABLE promos ADD COLUMN kind TEXT NOT NULL DEFAULT 'promo'");
  }
  if (!hasColumn(sqlite, "users", "role")) {
    sqlite.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'");
    sqlite.exec("UPDATE users SET role = 'owner' WHERE is_admin = 1");
  }
  // Role lama (staff/company) kini menjadi member.
  sqlite.exec("UPDATE users SET role = 'member' WHERE role IN ('staff', 'company')");
  ensureOwner(sqlite, file);
  return sqlite;
}
