# 07 — Model data (implementasi akhir)

## Keputusan implementasi

Rencana awal memakai kolom `owner_id` pada semua tabel. Selama implementasi kami memilih **satu file SQLite per pengguna**, karena:

- isolasi menjadi mutlak (tidak ada query yang bisa lupa menyaring `owner_id`);
- seluruh query upstream tetap tidak berubah;
- backup = salin satu direktori data;
- cocok untuk aplikasi gratis dengan banyak akun.

Skema jurnal tiap pengguna identik dengan skema upstream (semua fitur dipertahankan tanpa perubahan query).

## Dua database

| Database     | Lokasi                    | Isi                                                                                                                                                                  |
| ------------ | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Global       | `data/journal.db`         | `users`, `sessions`, `login_attempts`, `ai_usage`, `models`, `global_settings`                                                                                       |
| Per pengguna | `data/users/<user-id>.db` | Seluruh tabel jurnal upstream: accounts, executions, trades, journal_days, folders, notes, playbooks, settings, attachments, prop firms, market data, importer, dll. |

Akses diatur di [`apps/web/src/db/index.ts`](../apps/web/src/db/index.ts):

- `systemDb` → database global (drizzle biasa).
- `tenantDb(userId)` → membuka/meng-cache database pengguna.
- `db` → proxy tenant-aware; semua kode existing yang memakai `import { db } from "@/db"` otomatis diarahkan ke database pengguna yang sedang aktif.
- `runAsUser(userId, work)` → menetapkan konteks melalui `AsyncLocalStorage`; dipanggil oleh wrapper `handler()` di [`server/api.ts`](../apps/web/src/server/api.ts) setelah session terverifikasi.

Klien tidak pernah mengirim `userId`; nilai berasal dari cookie session yang ditandatangani dan dicocokkan dengan tabel `sessions`.

## Tabel global (baru)

### `users`

`id` (UUID, PK), `username`, `username_normalized` (unik), `password_hash` (salt:scrypt), `is_admin`, `created_at`, `last_login_at`.

### `sessions`

`id` (32 byte acak, PK), `user_id` → users, `expires_at`, `created_at`.

### `login_attempts`

`key` (IP + username), `failures`, `first_failure_at`, `last_failure_at`, `blocked_until` — untuk rate limit login & registrasi.

### `ai_usage`

`id`, `user_id`, `day` (UTC `YYYY-MM-DD`), `requests`, `updated_at` — unik per `(user_id, day)`. Dipakai kuota **10 permintaan/hari** (dapat diubah admin).

### `models`

`id` (model ID OpenRouter, PK), `name`, `tier` (`free`/`paid`), `context_length`, `supports_pdf`, `enabled`, `is_default`, `source` (`openrouter`/`admin`), `updated_at`.

Sinkronisasi `GET /api/v1/models` OpenRouter mengisi tabel ini; klasifikasi Free bila `pricing.prompt` dan `pricing.completion` keduanya `0`. Perubahan admin menandai `source = "admin"` sehingga tidak ditimpa sinkron berikutnya.

### `global_settings`

`key`, `value` — menyimpan `defaultModel`, `aiQuota`, `paidAllowed`, `lastModelSync`.

## Database per pengguna

Menggunakan `BOOTSTRAP_SQL` upstream apa adanya — tidak ada kolom atau primary key yang diubah. Pengaturan pengguna (`settings`), catatan harian (`journal_days.date` sebagai PK), dan lampiran tetap seperti semula karena tiap pengguna memiliki file sendiri.

## Enkripsi

`JOURNAL_SECRET` (atau file `.secret` yang dibuat otomatis) tetap menjadi sumber kunci AES-256-GCM untuk kredensial broker dan kunci OpenRouter BYOK. `AUTH_SECRET` dipakai untuk menandatangani cookie session. Simpan keduanya terpisah dari backup.

## Mode tes

`AUTH_DISABLED=1` (di-set oleh `vitest.config.ts`) memetakan semua akses ke `data/journal.db` dan melewati gate login, sehingga seluruh 645 tes upstream tetap berjalan tanpa perubahan perilaku fitur. Variabel ini **tidak boleh** diaktifkan di produksi.
