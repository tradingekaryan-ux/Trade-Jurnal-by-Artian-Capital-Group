# 20 — Audit Mendalam (28 Nov 2026)

Audit mencakup database Supabase, 69 endpoint API, seluruh halaman/komponen, autentikasi/role, AI/OpenRouter, dan integritas data. Verifikasi dilakukan dengan query langsung ke Supabase dan uji runtime lintas role (owner/member).

## Yang sudah diperbaiki pada batch ini

| Temuan                                                           | File                              | Perbaikan                                                                                                                    |
| ---------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Hapus trade/journal melaporkan `trades: 0`                       | `server/cascade.ts`               | Memakai helper `count()` dari postgres.js (`.count`, bukan `.length`)                                                        |
| Model Paid bisa disimpan walaupun `paidAllowed=false`            | `api/settings/route.ts`           | Validasi kini membaca katalog dari **Supabase** (`models` di `system.db` SQLite ternyata kosong) dan `await isPaidAllowed()` |
| BYOK tersimpan tidak terdeteksi saat ganti model                 | `api/settings/route.ts`           | Cek `getSetting("openrouterKeyEnc")` sebagai fallback                                                                        |
| Input kunci OpenRouter disabled saat kunci server ada            | `components/ai-settings.tsx`      | Input selalu aktif                                                                                                           |
| Model Paid via BYOK fallback ke kunci owner                      | `server/ai.ts`                    | `prepareAi` mengembalikan `keys` khusus BYOK untuk model Paid                                                                |
| Model dinonaktifkan masih dipakai                                | `server/ai.ts`                    | Query menyertakan `enabled`                                                                                                  |
| Token budget < 2000 untuk model reasoning free                   | `server/ai.ts`                    | Minimum 2000 token di `runAi`/`runAiWithImages`                                                                              |
| Kuota AI race condition                                          | `server/settings.ts`              | `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` atomik                                                                      |
| `GET /api/auth` mengembalikan 401, bukan `{authenticated:false}` | `api/auth/route.ts`               | Ditandai `{ public: true }`                                                                                                  |
| Logout gagal saat session expired                                | `api/auth/route.ts`               | `DELETE` ditandai `{ public: true }`                                                                                         |
| Cookie `Secure` tidak aktif di balik TLS termination             | `api/auth`, `api/register`        | `secure` juga berbasis `NODE_ENV=production`                                                                                 |
| First-register otomatis jadi owner                               | `api/register/route.ts`           | Dinonaktifkan di deployment Supabase; owner lewat `scripts/setup-owner.mjs` atau Admin                                       |
| `AUTH_SECRET` fallback publik & `AUTH_DISABLED` di produksi      | `server/auth.ts`, `server/api.ts` | Guard runtime production                                                                                                     |
| Attachment utilis lintas tenant tanpa auth                       | `api/attachments/[id]`            | Dibungkus `handler`, filter `owner_id`, redirect hanya ke imgdb.io                                                           |
| Open redirect gambar promo                                       | `api/promos/[id]/image`           | Validasi skema & host imgdb.io                                                                                               |
| SSRF di `avatar-proxy`                                           | `api/avatar-proxy/route.ts`       | Allowlist imgdb.io, blokir metadata/link-local/IPv6 ULA, redirect manual tervalidasi                                         |
| Sync Supabase→SQLite tiap request mahal                          | `server/legacy-sync.ts`           | Fingerprint cache; di-invalidate saat snapshot di-restore                                                                    |

## Temuan yang masih tertunda (prioritas)

### Tinggi

- **`api/accounts/[id]` DELETE & `api/accounts/[id]/actions` clear/transfer** hanya menyentuh SQLite; mirror `cfd_trades` bisa muncul lagi. Perlu sinkronisasi `account_id` di Supabase.
- **Snapshot JSON last-writer-wins** (`server/snapshot.ts`): dua instance Vercel bisa saling menimpa perubahan (notes/playbook/progress). Perlu optimistic concurrency atau tabel per-row di Supabase.
- **Tabel SQLite `prop_*` dan metadata attachment tidak ikut snapshot** (`snapshot.ts:TABLES`) — klaim "data folder `data/` bisa dihapus" belum benar untuk data prop firm.
- **Gambar imgdb.io tidak pernah dihapus** saat attachment/trade/post/akun dihapus — hanya referensi DB yang hilang. Perlu `deleteImage(imageId)` jika API menyediakan.
- **`initialBalance` ranking vs dashboard berbeda** (`server/ranking.ts` vs `api/stats`): ranking menjumlahkan saldo mentah tanpa konversi/filter; admin panel memakai 0. Perlu helper `resolveInitialBalance()` bersama.

### Sedang

- Validasi tipe body masih lemah di banyak endpoint (`journal/[date]`, `notes`, `playbooks`, `accounts`, `promos` PATCH) → `500` dengan pesan parser mentah. Perlu helper `readJson()` + `RequestError`.
- `server/api.ts` mengembalikan `error.message` mentah untuk error 500 — perlu pesan generik + `requestId`.
- Tidak ada pagination di endpoint list (`trades`, `notes`, `journal`, `posts`, `admin/member-data`, `export`).
- Throttle login/register mempercayai `X-Forwarded-For` → bisa di-bypass.
- `ai/ask` cache `Map` tanpa batas ukuran; cache key tidak memasukkan model/kunci.
- `api/ai/performance/pdf` memanggil AI ulang → kuota terpakai 2× untuk "analisis + unduh PDF".
- AI import tidak memvalidasi `supports_pdf` sebelum `consumeQuota()`.
- Orphan `notes.trade_key` / `trade_rule_checks` saat mirror trade dihapus.
- `avatar_id`/`banner_id` tidak disimpan di `profiles` saat ganti avatar.
- `login_attempts` cleanup memakai `LIKE` pada username (`_` adalah wildcard).

### Frontend (sedang/rendah)

- Handler async tanpa `try/catch` di Accounts, Trades bulk, Trade detail, Notebook, Playbooks, Profile `savePost`, logout → gagal silently / `busy` stuck / sukses palsu.
- `JSON.parse` tanpa guard di trade detail dapat crash render.
- Mata uang hard-coded USD di trades/journal/share/ranking.
- Share page memakai timezone browser, bukan timezone jurnal.
- Slider frame video tidak berpengaruh pada export (selalu mulai dari 0).
- `onWheel` React bersifat passive → `preventDefault()` gagal saat zoom background.
- Object URL background tidak di-`revokeObjectURL` → memory leak.
- Empty state ditampilkan sebelum fetch selesai di ranking/promo/ideas/profile.

### Rendah / housekeeping

- `/api/progress`, `/api/missed`, `/api/folders` GET = 404/405 (by design; halaman memakai `/api/workspace/*`).
- Kolom `cfd_trades.image_urls` dead (`'[]'` selalu).
- Tabel SQLite `cfd_trades` duplikat tidak pernah dipakai.
- `promo_votes.value` tanpa `CHECK` constraint; tidak ada index pada `user_id`.
- Versi `EDGE_SCORE_VERSION` tidak dikirim ke klien ranking/sertifikat.

## Catatan positif

- scrypt + salt + `timingSafeEqual` untuk password; HMAC session dengan expirasi.
- Isolasi tenant SQLite via `handler` + `runAsUser` konsisten; tidak ada endpoint SQLite biasa yang bisa membaca data user lain.
- SQL injection, XSS (`react-markdown` tanpa `rehype-raw`), dan path traversal tidak ditemukan.
- Role owner/admin/member ditegakkan server-side; admin tidak bisa mengakses kunci/model config.
