import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomBytes, scryptSync } from "node:crypto";
import postgres from "../apps/web/node_modules/postgres/src/index.js";

/** Create the owner account in Supabase if it does not exist yet. */
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL tidak di-set.");
  process.exit(1);
}
const credentialsPath = join(process.cwd(), "apps", "web", "data", "owner-credentials.txt");
let username = process.env.OWNER_USERNAME;
let password = process.env.OWNER_PASSWORD;
if (existsSync(credentialsPath)) {
  const lines = readFileSync(credentialsPath, "utf8").split("\n");
  username ||= lines
    .find((l) => l.startsWith("username:"))
    ?.replace("username:", "")
    .trim();
  password ||= lines
    .find((l) => l.startsWith("password:"))
    ?.replace("password:", "")
    .trim();
}
username ||= "owner";
password ||= randomBytes(12).toString("base64url");

const sql = postgres(url, { max: 1, connect_timeout: 20 });
try {
  const existing =
    await sql`select id from users where username_normalized = ${username.toLowerCase()}`;
  if (existing.length) {
    console.log("Owner sudah ada:", username);
  } else {
    const salt = randomBytes(16).toString("hex");
    const hash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
    await sql`insert into users (id, username, username_normalized, password_hash, is_admin, role, created_at)
      values (${randomBytes(16).toString("hex")}, ${username}, ${username.toLowerCase()}, ${hash}, true, 'owner', ${new Date().toISOString()})`;
    console.log("Owner dibuat di Supabase:", username);
  }
} finally {
  await sql.end();
}
