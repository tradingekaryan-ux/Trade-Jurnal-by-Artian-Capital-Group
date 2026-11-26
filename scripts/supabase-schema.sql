-- Trade Jurnal by Artian Capital Group — skema Supabase (Postgres)
-- Dijalankan sekali via: node scripts/setup-supabase.mjs
-- Semua data di sini berada di luar server aplikasi, sehingga aman jika
-- container Northflank dimatikan atau dihapus.

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  username text NOT NULL,
  username_normalized text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  role text NOT NULL DEFAULT 'member',
  created_at text NOT NULL,
  last_login_at text
);

CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at text NOT NULL,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS login_attempts (
  key text PRIMARY KEY,
  failures integer NOT NULL DEFAULT 0,
  first_failure_at text NOT NULL,
  last_failure_at text NOT NULL,
  blocked_until text
);

CREATE TABLE IF NOT EXISTS ai_usage (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day text NOT NULL,
  requests integer NOT NULL DEFAULT 0,
  updated_at text NOT NULL,
  UNIQUE (user_id, day)
);

CREATE TABLE IF NOT EXISTS models (
  id text PRIMARY KEY,
  name text NOT NULL,
  tier text NOT NULL DEFAULT 'paid',
  context_length integer,
  supports_pdf boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'openrouter',
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS global_settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

CREATE TABLE IF NOT EXISTS promos (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'promo',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_url text,
  image_id text,
  image_name text,
  promo_code text,
  code_enabled boolean NOT NULL DEFAULT false,
  url text,
  url_enabled boolean NOT NULL DEFAULT false,
  created_at text NOT NULL,
  updated_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS promos_user_idx ON promos (user_id);
CREATE INDEX IF NOT EXISTS promos_created_idx ON promos (created_at DESC);

CREATE TABLE IF NOT EXISTS promo_votes (
  id text PRIMARY KEY,
  promo_id text NOT NULL REFERENCES promos(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL,
  UNIQUE (promo_id, user_id)
);
CREATE INDEX IF NOT EXISTS promo_votes_promo_idx ON promo_votes (promo_id);

-- Journal entries (CFD / futures / crypto / stock).
CREATE TABLE IF NOT EXISTS cfd_trades (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id text,
  category text NOT NULL,
  symbol text NOT NULL,
  mode text NOT NULL,
  side text NOT NULL,
  lot real NOT NULL,
  entry real NOT NULL,
  take_profit real,
  stop_loss real,
  exit_price real,
  result_mode text NOT NULL DEFAULT 'auto',
  manual_pnl real,
  usd_per_pip real,
  leverage real,
  pips real,
  pnl real,
  risk_reward real,
  r_multiple real,
  status text NOT NULL,
  opened_at text NOT NULL,
  closed_at text,
  notes text,
  image_urls text NOT NULL DEFAULT '[]',
  created_at text NOT NULL,
  updated_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS cfd_trades_owner_idx ON cfd_trades (owner_id);
CREATE INDEX IF NOT EXISTS cfd_trades_mode_idx ON cfd_trades (owner_id, mode);
CREATE INDEX IF NOT EXISTS cfd_trades_opened_idx ON cfd_trades (owner_id, opened_at DESC);

-- Image references for journal entries / trades (actual bytes live on imgdb.io).
CREATE TABLE IF NOT EXISTS image_attachments (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_type text NOT NULL,
  owner_ref text NOT NULL,
  url text NOT NULL,
  image_id text NOT NULL,
  name text NOT NULL,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS image_attachments_owner_idx
  ON image_attachments (owner_id, owner_type, owner_ref);

-- User profile: bio + images hosted on imgdb.io.
CREATE TABLE IF NOT EXISTS profiles (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  avatar_url text,
  avatar_id text,
  banner_url text,
  banner_id text,
  updated_at text NOT NULL
);

-- Snapshot seluruh data jurnal per user. Supabase = source of truth,
-- SQLite lokal hanya cache yang bisa dihapus/restored kapan saja.
CREATE TABLE IF NOT EXISTS journal_snapshots (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  updated_at text NOT NULL
);
