import { blob, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/** Global tables: accounts, sessions, model catalog and AI quota. One DB for the whole site. */
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    usernameNormalized: text("username_normalized").notNull(),
    passwordHash: text("password_hash").notNull(),
    isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
    role: text("role").notNull().default("member"),
    createdAt: text("created_at").notNull(),
    lastLoginAt: text("last_login_at"),
  },
  (table) => [uniqueIndex("users_username_unique").on(table.usernameNormalized)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("sessions_user").on(table.userId),
    index("sessions_expiry").on(table.expiresAt),
  ],
);

export const loginAttempts = sqliteTable("login_attempts", {
  key: text("key").primaryKey(),
  failures: integer("failures").notNull().default(0),
  firstFailureAt: text("first_failure_at").notNull(),
  lastFailureAt: text("last_failure_at").notNull(),
  blockedUntil: text("blocked_until"),
});

export const aiUsage = sqliteTable(
  "ai_usage",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: text("day").notNull(),
    requests: integer("requests").notNull().default(0),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("ai_usage_user_day").on(table.userId, table.day)],
);

/**
 * OpenRouter model catalog. Admin may edit tier/enabled/default; a manual edit
 * flips `source` to "admin" so a later sync from OpenRouter never overwrites it.
 */
export const models = sqliteTable("models", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tier: text("tier", { enum: ["free", "paid"] })
    .notNull()
    .default("paid"),
  contextLength: integer("context_length"),
  supportsPdf: integer("supports_pdf", { mode: "boolean" }).notNull().default(false),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  source: text("source", { enum: ["openrouter", "admin"] })
    .notNull()
    .default("openrouter"),
  updatedAt: text("updated_at").notNull(),
});

export const globalSettings = sqliteTable("global_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/** Public promo/discount posts. Images live in the global DB so every account can see them. */
export const promos = sqliteTable(
  "promos",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    imageData: blob("image_data", { mode: "buffer" }),
    imageMime: text("image_mime"),
    imageName: text("image_name"),
    promoCode: text("promo_code"),
    codeEnabled: integer("code_enabled", { mode: "boolean" }).notNull().default(false),
    url: text("url"),
    urlEnabled: integer("url_enabled", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("promos_user").on(table.userId), index("promos_created").on(table.createdAt)],
);
