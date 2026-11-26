# 08 — Rencana implementasi

## Kriteria penerimaan (definition of done)

1. Semua fitur yang tercantum di [`03-daftar-fitur.md`](03-daftar-fitur.md) berfungsi sebagaimana upstream.
2. Registrasi & login memakai username + password, **tanpa** email/OTP/verifikasi.
3. Pengguna A tidak dapat melihat atau mengubah data pengguna B, termasuk lewat ID yang ditebak langsung ke API.
4. Semua fitur AI berjalan melalui OpenRouter; tidak ada permintaan langsung ke Anthropic/OpenAI.
5. Kunci OpenRouter tidak pernah dikirim ke browser ataupun dicatat di log.
6. `pnpm test`, `pnpm typecheck`, dan `pnpm build` lulus.
7. Dokumentasi pengguna (cara pakai) dan dokumentasi operator (cara deploy & env) tersedia.

## Tahapan kerja

### Tahap 0 — Persetujuan & keputusan (sekarang)

- Anda menyetujui dokumentasi ini.
- Anda menjawab 4 keputusan di [`README.md`](README.md#keputusan-yang-perlu-anda-konfirmasi-sebelum-implementasi).
- Anda menyiapkan OpenRouter API key (atau memutuskan BYOK).

### Tahap 1 — Fork & branding

- Salin kode upstream ke workspace sebagai dasar.
- Ganti nama aplikasi, metadata, header/sidebar/footer, favicon & logo ke **Trade Jurnal by Artian Capital Group**.
- Sesuaikan `.env.example`, README, docker-compose.
- Pastikan seluruh tes upstream masih lulus sebelum perubahan besar.

### Tahap 2 — Autentikasi & multi-tenancy (risiko terbesar)

- Buat tabel `users`, `sessions`, `login_attempts`.
- Implementasi registrasi, login, logout, rate limit, hash scrypt, session rotation.
- Bangun database global + proxy `db` tenant-aware (`runAsUser` via `AsyncLocalStorage`), tanpa mengubah query jurnal yang ada.
- Perbarui middleware: hanya `/login`, `/register`, aset statis yang publik.
- **Tes isolasi:** session pengguna hanya membuka file database miliknya.

### Tahap 3 — Migrasi AI ke OpenRouter

- Ubah `server/ai.ts`, `lib/ai-settings.ts`, `server/settings.ts`, `components/ai-settings.tsx`.
- Ubah `server/ai-import.ts` & `lib/ai-import.ts` untuk memakai adapter OpenRouter.
- Terapkan kuota, daftar model, header `HTTP-Referer`/`X-Title`, dan error mapping.
- Tes tiga route AI + AI import dengan kunci uji (biaya kecil).

### Tahap 4 — Regresi seluruh fitur

- Jalankan seluruh tes upstream (`pnpm test`) + tes baru auth/tenant/OpenRouter.
- Uji manual alur: daftar → login → input manual → import CSV → recap → critique → ask → ekspor → logout.
- Uji alur broker/market data bila kredensial tersedia (boleh dilewati bila tidak ada).

### Tahap 5 — Hardening & deployment

- Rate limit produksi, batas kuota, validasi upload, header keamanan.
- Docker Compose + volume persisten + reverse proxy HTTPS.
- Panduan backup/restore (`JOURNAL_SECRET` + direktori data).
- Finalisasi dokumentasi pengguna & operator.

## Risiko & mitigasi

| Risiko                                                   | Dampak          | Mitigasi                                                                                        |
| -------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------- |
| Kebocoran data lintas pengguna                           | Kritis          | Satu file DB per pengguna, konteks dari session terverifikasi, bukan dari input klien           |
| Kompleksitas refactor multi-tenancy                      | Sedang          | Kerjakan tabel per grup, jalankan tes setelah setiap grup                                       |
| Model OpenRouter tidak mendukung PDF / structured output | AI import gagal | Pilih model yang mendukung keduanya, validasi di awal, pesan error jelas & sarankan ekspor teks |
| Biaya AI membengkak                                      | Finansial       | Model murah, `maxOutputTokens`, daftar model, kuota harian, opsi BYOK                           |
| Registrasi tanpa verifikasi disalahgunakan               | Operasional     | Rate limit, batas akun, CAPTCHA opsional, monitoring                                            |
| Perubahan upstream API (pre-1.0)                         | Maintenance     | Pin versi paket, dokumentasikan versi basis yang dipakai                                        |

## Estimasi relatif

Tahap 2 memakan porsi terbesar karena menyentuh hampir semua route handler. Tahap 1 dan 3 relatif kecil (berikut pola yang sudah ada di upstream). Tahap 4–5 dapat dikerjakan paralel dengan penulisan dokumentasi akhir.

## Urutan eksekusi setelah persetujuan

Implementasi akan dimulai dari **Tahap 1**, lalu **Tahap 2**, **Tahap 3**, dan seterusnya. Anda akan menerima hyperlink ke file yang berubah pada setiap tahap.
