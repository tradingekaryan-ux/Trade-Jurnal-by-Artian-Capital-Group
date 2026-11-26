import { eq } from "drizzle-orm";
import { systemDb } from "@/db";
import { users } from "@/db/system-schema";
import { bad, handler, ok, requireValue } from "@/server/api";
import { currentUser, hashPassword } from "@/server/auth";
import { newId, nowIso } from "@/server/ids";
import { canManageUsers, isUserRole, USER_ROLES, type UserRole } from "@/lib/roles";

const ownerOnly = async () => {
  const user = await currentUser();
  return Boolean(user && canManageUsers(user.role));
};

export const GET = handler(async () => {
  if (!(await ownerOnly())) return bad("Forbidden", 403);
  return ok({
    users: systemDb
      .select({
        id: users.id,
        username: users.username,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .all(),
  });
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
    "Role tidak valid. Owner hanya bisa dibuat melalui akun owner bawaan.",
  );
  const existing = systemDb
    .select({ id: users.id })
    .from(users)
    .where(eq(users.usernameNormalized, username.toLowerCase()))
    .get();
  requireValue(!existing, "Username sudah dipakai.");
  const role = body.role as UserRole;
  const id = newId();
  systemDb
    .insert(users)
    .values({
      id,
      username,
      usernameNormalized: username.toLowerCase(),
      passwordHash: hashPassword(password),
      role,
      isAdmin: role === "admin",
      createdAt: nowIso(),
    })
    .run();
  return ok({ id, username, role }, { status: 201 });
});

export const PATCH = handler(async (request: Request) => {
  if (!(await ownerOnly())) return bad("Forbidden", 403);
  const body = (await request.json()) as { id?: string; role?: string };
  requireValue(typeof body.id === "string", "User id diperlukan.");
  requireValue(isUserRole(body.role) && body.role !== "owner", "Role tidak valid.");
  const current = systemDb.select().from(users).where(eq(users.id, body.id!)).get();
  requireValue(Boolean(current), "User tidak ditemukan.");
  requireValue(current!.role !== "owner", "Role owner tidak bisa diubah.");
  const role = body.role as UserRole;
  systemDb
    .update(users)
    .set({ role, isAdmin: role === "admin" })
    .where(eq(users.id, body.id!))
    .run();
  return ok({ updated: true });
});
