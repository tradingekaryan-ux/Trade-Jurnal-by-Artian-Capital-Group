import { bad, handler, ok, requireValue } from "@/server/api";
import { currentUser, hashPassword } from "@/server/auth";
import { newId, nowIso } from "@/server/ids";
import { sql } from "@/server/pg";
import {
  canDeleteAccounts,
  canManageUsers,
  canReadAllData,
  isUserRole,
  type UserRole,
} from "@/lib/roles";

const privilege = async () => {
  const user = await currentUser();
  return user && canReadAllData(user.role) ? user : null;
};

const ownerOnly = async () => {
  const user = await currentUser();
  return Boolean(user && canManageUsers(user.role));
};

export const GET = handler(async () => {
  if (!(await privilege())) return bad("Forbidden", 403);
  const rows = await sql`select id, username, role, created_at from users order by created_at`;
  return ok({ users: rows });
});

export const POST = handler(async (request: Request) => {
  if (!(await ownerOnly())) return bad("Forbidden", 403);
  const body = (await request.json()) as { username?: string; password?: string; role?: string };
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  requireValue(/^[a-zA-Z0-9_-]{3,32}$/.test(username), "Username tidak valid.");
  requireValue(password.length >= 8 && password.length <= 200, "Password minimal 8 karakter.");
  requireValue(
    isUserRole(body.role) && body.role !== "owner",
    "Role tidak valid. Owner hanya ada satu.",
  );
  const role = body.role as UserRole;
  const existing =
    await sql`select id from users where username_normalized = ${username.toLowerCase()} limit 1`;
  requireValue(existing.length === 0, "Username sudah dipakai.");
  const id = newId();
  await sql`insert into users (id, username, username_normalized, password_hash, is_admin, role, created_at)
    values (${id}, ${username}, ${username.toLowerCase()}, ${hashPassword(password)}, ${role === "admin"}, ${role}, ${nowIso()})`;
  return ok({ id, username, role }, { status: 201 });
});

export const PATCH = handler(async (request: Request) => {
  if (!(await ownerOnly())) return bad("Forbidden", 403);
  const body = (await request.json()) as { id?: string; role?: string };
  requireValue(typeof body.id === "string", "User id diperlukan.");
  requireValue(isUserRole(body.role) && body.role !== "owner", "Role tidak valid.");
  const rows = await sql`select role from users where id = ${body.id!} limit 1`;
  requireValue(rows.length > 0, "User tidak ditemukan.");
  requireValue(rows[0]!.role !== "owner", "Role owner tidak bisa diubah.");
  const role = body.role as UserRole;
  await sql`update users set role = ${role}, is_admin = ${role === "admin"} where id = ${body.id!}`;
  return ok({ updated: true });
});

/** Owner and admin may delete accounts. Owner and the current account are protected.
 *  Every Supabase user-data table references users with ON DELETE CASCADE, so
 *  sessions, votes, posts, journals, images, profiles and snapshots go with it. */
export const DELETE = handler(async (request: Request) => {
  const user = await privilege();
  requireValue(Boolean(user && canDeleteAccounts(user.role)), "Forbidden.");
  const body = (await request.json().catch(() => ({}))) as { id?: string };
  requireValue(typeof body.id === "string" && body.id.length > 0, "User id diperlukan.");
  const rows = await sql`select id, role from users where id = ${body.id!} limit 1`;
  requireValue(rows.length > 0, "User tidak ditemukan.");
  requireValue(rows[0]!.role !== "owner", "Akun owner tidak bisa dihapus.");
  requireValue(rows[0]!.id !== user!.id, "Akun sendiri tidak bisa dihapus.");
  await sql`delete from users where id = ${body.id!}`;
  return ok({ deleted: true });
});
