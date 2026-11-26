import { handler, ok, requireValue } from "@/server/api";
import { currentUser } from "@/server/auth";
import { nowIso } from "@/server/ids";
import { sql } from "@/server/pg";
import { uploadImage, MAX_IMAGE_BYTES } from "@/lib/imgdb";

export const GET = handler(async (request: Request) => {
  const userId = new URL(request.url).searchParams.get("userId");
  const target = userId || (await currentUser())?.id;
  requireValue(Boolean(target), "User tidak ditemukan.");
  const targetId = target!;
  const rows = await sql`
    select p.display_name, p.bio, p.avatar_url, p.banner_url, p.updated_at,
           u.username, u.role, u.created_at
    from profiles p join users u on p.user_id = u.id
    where p.user_id = ${targetId} limit 1
  `;
  if (!rows.length) {
    const users =
      await sql`select username, role, created_at from users where id = ${targetId} limit 1`;
    if (!users.length) return ok({ profile: null });
    return ok({
      profile: {
        ...users[0],
        display_name: "",
        bio: "",
        avatar_url: null,
        banner_url: null,
        updated_at: null,
      },
    });
  }
  return ok({ profile: rows[0] });
});

export const PATCH = handler(async (request: Request) => {
  const user = await currentUser();
  requireValue(Boolean(user), "Unauthorized.");
  const form = await request.formData();
  requireValue(
    Number(request.headers.get("content-length") ?? 0) <= MAX_IMAGE_BYTES * 2 + 20_000,
    "Gambar terlalu besar.",
  );
  const displayName = String(form.get("displayName") ?? "")
    .trim()
    .slice(0, 80);
  const bio = String(form.get("bio") ?? "")
    .trim()
    .slice(0, 2000);

  const existing =
    await sql`select avatar_url, banner_url from profiles where user_id = ${user!.id} limit 1`;
  let avatarUrl: string | null = existing[0]?.avatar_url ?? null;
  let avatarId: string | null = null;
  let bannerUrl: string | null = existing[0]?.banner_url ?? null;
  let bannerId: string | null = null;

  const avatar = form.get("avatar");
  if (avatar instanceof File && avatar.size > 0) {
    requireValue(avatar.size <= MAX_IMAGE_BYTES, "Foto profil maksimal 16 MB.");
    const uploaded = await uploadImage(Buffer.from(await avatar.arrayBuffer()), avatar.name);
    avatarUrl = uploaded.url;
    avatarId = uploaded.id;
  }
  const banner = form.get("banner");
  if (banner instanceof File && banner.size > 0) {
    requireValue(banner.size <= MAX_IMAGE_BYTES, "Banner maksimal 16 MB.");
    const uploaded = await uploadImage(Buffer.from(await banner.arrayBuffer()), banner.name);
    bannerUrl = uploaded.url;
    bannerId = uploaded.id;
  }

  await sql`insert into profiles
    (user_id, display_name, bio, avatar_url, banner_url, updated_at)
    values (${user!.id}, ${displayName}, ${bio}, ${avatarUrl}, ${bannerUrl}, ${nowIso()})
    on conflict (user_id) do update set
      display_name = ${displayName}, bio = ${bio},
      avatar_url = ${avatarUrl}, banner_url = ${bannerUrl}, updated_at = ${nowIso()}`;

  if (avatarId || bannerId) {
    const rows =
      await sql`select avatar_url, banner_url from profiles where user_id = ${user!.id} limit 1`;
    return ok({ profile: rows[0] });
  }
  return ok({ saved: true });
});
