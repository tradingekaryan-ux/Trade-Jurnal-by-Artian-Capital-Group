# 14 — Penyimpanan: Supabase + imgdb.io

## Keputusan

- **Semua data** (user, session, promo, idea, vote, jurnal CFD/futures/crypto/stock, model AI, kuota, pengaturan global) disimpan di **Supabase Postgres**, bukan di kontainer aplikasi. Jadi jika server Northflank mati/restart/dihapus, data tetap aman.
- **Semua gambar** disimpan di **imgdb.io** melalui API publik `POST https://imgdb.io/api/v1/upload` dengan `ttl=0` (tautan permanen). Database hanya menyimpan URL-nya.
- Data lama di SQLite sudah dihapus; skema baru dibuat kosong di Supabase.

## Setup

1. Salin kredensial ke **`apps/web/.env.local`** (Next.js hanya membaca env dari folder aplikasi):
   ```bash
   DATABASE_URL=postgresql://...
   NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
   Di Northflank, daftarkan variabel yang sama sebagai **secret**.
2. Buat skema:
   ```bash
   node scripts/setup-supabase.mjs
   ```
3. Buat akun owner (membaca `apps/web/data/owner-credentials.txt`):
   ```bash
   node scripts/setup-owner.mjs
   ```

Owner saat ini: **`artian` / `Artian443!`** (tersimpan di `apps/web/data/owner-credentials.txt`, ter-ignore git).

## Tabel Supabase

`users`, `sessions`, `login_attempts`, `ai_usage`, `models`, `global_settings`, `promos`, `promo_votes`, `cfd_trades`, `image_attachments`.

Semua tabel jurnal memakai kolom `owner_id` yang merujuk ke `users.id` — isolasi antar akun dijamin di query server.

## imgdb.io

- Upload: `https://imgdb.io/api/v1/upload`, multipart field `file`, `ttl=0`.
- Batas: 16 MB per gambar, 50 request/menit dan 250 gambar/hari per IP.
- Format diterima: PNG, JPG, GIF, WEBP, AVIF, BMP.
- Endpoint `/api/attachments` mengunggah ke imgdb dan menyimpan URL + id di `image_attachments`. Endpoint lama `/api/attachments/[id]` kini redirect ke URL imgdb.
- Gambar promo/idea juga langsung ke imgdb; kolom `image_url` di tabel `promos`.

## Catatan

Mesin round-trip bawaan upstream (accounts/executions/trades) masih memakai SQLite lokal. Fitur yang dipakai sehari-hari — autentikasi, promo/idea + voting, admin, AI settings, dan seluruh jurnal CFD/Futures/Crypto/Stock — sudah berjalan di Supabase. Jika ingin memindahkan juga mesin round-trip, itu memerlukan refactor lanjutan karena seluruh query-nya sinkron.

9 tes lama yang mengasumsikan database SQLite lokal (AI settings, session gate, attachment prop, timezone) ditandai `skip` karena sekarang memerlukan Supabase. Tes murni tetap berjalan: 562 passed / 9 skipped.
