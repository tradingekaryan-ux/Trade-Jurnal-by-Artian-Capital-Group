import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "../apps/web/node_modules/postgres/src/index.js";

/**
 * End-to-end check for cascading deletion: journal → trades/images,
 * post → votes, account → everything (Supabase + local SQLite file).
 * Run against a live preview server with the owner account available.
 */
const base = "http://localhost:3000";
const env = readFileSync(new URL("../apps/web/.env.local", import.meta.url), "utf8");
const url = env.match(/DATABASE_URL=(.*)/)?.[1]?.trim();
if (!url) throw new Error("DATABASE_URL tidak ditemukan di apps/web/.env.local");
const sql = postgres(url, { max: 1 });
const icon = readFileSync(new URL("../apps/web/public/brand/artian-icon.png", import.meta.url));

const assert = (condition, label) => {
  if (!condition) throw new Error(`FAIL: ${label}`);
  console.log("ok:", label);
};
const scalar = async (strings, ...values) => Number((await sql(strings, ...values))[0]?.n ?? 0);
const login = async (username, password) => {
  const response = await fetch(`${base}/api/auth`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) throw new Error(`login ${username}: ${await response.text()}`);
  return response.headers.get("set-cookie").split(";")[0];
};
const api = async (path, body, cookie, method = "POST") => {
  const response = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path}: ${await response.text()}`);
  return response.json();
};
const form = async (path, data, cookie, method = "POST") => {
  const response = await fetch(base + path, { method, headers: { cookie }, body: data });
  if (!response.ok) throw new Error(`${path}: ${await response.text()}`);
  return response.json();
};
const promoForm = (title) => {
  const data = new FormData();
  data.set("title", title);
  data.set("description", "Data uji cascade.");
  data.set("kind", "promo");
  data.set("image", new Blob([icon], { type: "image/png" }), "icon.png");
  return data;
};

let ownerCookie;
let createdUserId;

try {
  const owner = await login("artian", "Artian443!");
  ownerCookie = owner;
  const username = `cascade${Date.now().toString().slice(-6)}`;
  const created = await api(
    "/api/admin/users",
    { username, password: "Cascade443!", role: "member" },
    owner,
  );
  const userId = created.id;
  createdUserId = userId;
  const member = await login(username, "Cascade443!");
  console.log(`akun uji: ${username}`);

  // Data milik akun uji di Supabase dan di cache SQLite lokal.
  const trade = await api(
    "/api/cfd-journal",
    {
      mode: "cfd",
      symbol: "EURUSD",
      side: "buy",
      size: 1,
      entry: 1.08,
      exit: 1.085,
      stopLoss: 1.07,
      takeProfit: 1.09,
      resultMode: "auto",
      openedAt: new Date().toISOString(),
    },
    member,
  );
  await sql`insert into image_attachments
    (id, owner_id, owner_type, owner_ref, url, image_id, name, created_at)
    values (${`img-${trade.id}`}, ${userId}, 'cfd-trade', ${trade.id},
      'https://example.com/x.png', 'x', 'x.png', ${new Date().toISOString()})`;
  const post = await form("/api/promos", promoForm("Cascade promo"), member);
  const ownerPosts = await (
    await fetch(`${base}/api/posts`, { headers: { cookie: owner } })
  ).json();
  const ownerPost = ownerPosts.posts.find((item) => item.author === "artian");
  await api("/api/promos/vote", { promoId: post.id, value: "working" }, owner);
  if (ownerPost) await api("/api/promos/vote", { promoId: ownerPost.id, value: "working" }, member);
  const profile = new FormData();
  profile.set("displayName", "Cascade Test");
  profile.set("bio", "bio");
  await form("/api/profile", profile, member, "PATCH");
  await api("/api/notes", { title: "Catatan cascade", content: "isi" }, member).catch(() => {
    console.log("info: catatan lokal tidak dibuat (folder bawaan belum ada)");
  });
  await api("/api/snapshot", {}, member);

  assert(
    (await scalar`select count(*)::int n from cfd_trades where owner_id = ${userId}`) === 1,
    "1 trade dibuat",
  );
  assert(
    (await scalar`select count(*)::int n from image_attachments where owner_id = ${userId}`) === 1,
    "1 lampiran gambar dibuat",
  );
  assert(
    (await scalar`select count(*)::int n from promos where user_id = ${userId}`) === 1,
    "1 postingan dibuat",
  );
  assert(
    (await scalar`select count(*)::int n from promo_votes where promo_id = ${post.id}`) >= 1,
    "vote pada postingan dibuat",
  );
  assert(
    (await scalar`select count(*)::int n from profiles where user_id = ${userId}`) === 1,
    "profil dibuat",
  );
  const localFile = join(process.cwd(), "apps/web/data/users", `${userId}.db`);
  assert(existsSync(localFile), "file SQLite lokal dibuat");

  // 1) Hapus jurnal → trade + gambar ikut terhapus.
  const journalDelete = await api("/api/cfd-journal?mode=cfd", undefined, member, "DELETE");
  assert(
    journalDelete.trades === 1 && journalDelete.images === 1,
    "hapus jurnal menghapus trade + gambar",
  );
  assert(
    (await scalar`select count(*)::int n from cfd_trades where owner_id = ${userId}`) === 0,
    "trade hilang dari Supabase",
  );
  assert(
    (await scalar`select count(*)::int n from image_attachments where owner_id = ${userId}`) === 0,
    "gambar hilang dari Supabase",
  );

  // 2) Hapus postingan → voting ikut terhapus.
  const postDelete = await api(
    `/api/promos?id=${encodeURIComponent(post.id)}`,
    undefined,
    member,
    "DELETE",
  );
  assert(postDelete.votesDeleted >= 1, "hapus postingan menghapus vote");
  assert(
    (await scalar`select count(*)::int n from promo_votes where promo_id = ${post.id}`) === 0,
    "vote hilang dari Supabase",
  );
  assert(
    (await scalar`select count(*)::int n from promos where id = ${post.id}`) === 0,
    "postingan hilang dari Supabase",
  );

  // 3) Hapus akun → semua sisa data hilang, termasuk file SQLite lokal.
  const removed = await api("/api/admin/users", { id: userId }, owner, "DELETE");
  const r = removed.removed ?? {};
  assert(r.posts === 0, "tidak ada sisa postingan");
  assert(r.castVotes >= 1, "vote yang diberikan akun ikut dihapus");
  assert(r.profiles === 1 && r.snapshots === 1, "profil & snapshot ikut dihapus");
  assert(
    (await scalar`select count(*)::int n from users where id = ${userId}`) === 0,
    "akun hilang",
  );
  assert(
    (await scalar`select count(*)::int n from promo_votes where user_id = ${userId}`) === 0,
    "vote oleh akun hilang",
  );
  assert(
    (await scalar`select count(*)::int n from journal_snapshots where user_id = ${userId}`) === 0,
    "snapshot hilang",
  );
  assert(
    (await scalar`select count(*)::int n from profiles where user_id = ${userId}`) === 0,
    "profil hilang",
  );
  assert(
    (await scalar`select count(*)::int n from sessions where user_id = ${userId}`) === 0,
    "sesi hilang",
  );
  assert(!existsSync(localFile), "file SQLite lokal akun hilang");
  console.log("SEMUA CEK CASCADE LOLOS", r);
} finally {
  // Bersihkan akun uji jika salah satu pemeriksaan gagal di tengah jalan.
  if (createdUserId && ownerCookie) {
    try {
      await api("/api/admin/users", { id: createdUserId }, ownerCookie, "DELETE");
      console.log("cleanup: akun uji dihapus");
    } catch {
      // Sudah dihapus pada langkah terakhir.
    }
  }
  await sql.end();
}
