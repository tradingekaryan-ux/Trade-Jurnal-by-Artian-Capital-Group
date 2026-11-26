# 06 — API yang dibutuhkan

> **Tidak ada fitur opsional tambahan yang dipasang.** Aplikasi hanya berisi fitur inti dari library upstream, autentikasi username/password, integrasi OpenRouter, dan data feed Hyperliquid untuk indeks/komoditas/forex. Tidak ada CAPTCHA, monitoring pihak ketiga, email, atau pembayaran.

## 1. Wajib

| #   | Kredensial / Infrastruktur                        | Fungsi                                                                                      | Catatan                                                                                                                                                         |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **OpenRouter API key** — satu atau beberapa kunci | Seluruh fitur AI: ringkasan sesi, kritik trade, "ask your journal", dan AI statement import | Dibaca hanya oleh server. Kunci **tidak pernah** dikirim ke browser atau disimpan di source code/GitHub.                                                        |
| 2   | **Server Node.js 22+ dengan disk persisten**      | Menjalankan aplikasi & menyimpan SQLite                                                     | `pnpm` 11.0.8. Platform tanpa disk persisten tidak cocok. HTTPS disarankan untuk cookie `Secure`.                                                               |
| 3   | `AUTH_SECRET`                                     | Menandatangani cookie session                                                               | Wajib di produksi. Nilai berbeda untuk tiap deployment.                                                                                                         |
| 4   | **Hyperliquid public API**                        | Data harga & chart candle untuk indeks, komoditas, dan forex                                | `https://api.hyperliquid.xyz/info`, endpoint `candleSnapshot` (HIP-3). **Tanpa API key**. Simbol lain tidak didukung; lihat [`market-data.md`](market-data.md). |

Variabel pendukung: `SITE_URL` (dikirim sebagai `HTTP-Referer` ke OpenRouter), `OPENROUTER_BASE_URL` (default `https://openrouter.ai/api/v1`), `JOURNAL_SECRET` (enkripsi kredensial), `ADMIN_USERNAME` (opsional).

## 2. Fallback beberapa kunci OpenRouter

Kunci disimpan di **environment server**, bukan di kode. Gunakan `.env.local` untuk lokal (sudah ada di `.gitignore`) dan environment variable / secret manager di hosting.

```bash
# .env.local — contoh, jangan commit nilai aslinya
OPENROUTER_API_KEYS=kunci_1,kunci_2,kunci_3,...,kunci_9
OPENROUTER_API_KEY=kunci_cadangan_tunggal
AUTH_SECRET=rahasia-session
SITE_URL=https://domain-anda
```

Perilaku:

- Urutan pemakaian: **kunci milik pengguna (BYOK, jika ada)** → semua kunci di `OPENROUTER_API_KEYS` berurutan → `OPENROUTER_API_KEY`.
- Jika suatu kunci gagal karena `401/403` (auth), `402` (saldo habis), `429/529` (rate limit), atau tidak ada respons jaringan, server **otomatis mencoba kunci berikutnya** dalam satu permintaan yang sama.
- Kegagalan karena model tidak tersedia (`404`) atau kesalahan format tidak memicu pergantian kunci.
- Kuota pengguna (**10 permintaan/hari**, diatur admin) dihitung **satu kali per permintaan**, bukan per kunci yang dicoba.
- Kunci yang gagal tidak dicatat ke log; pesan error yang ditampilkan ke pengguna tidak memuat potongan kunci.

Semua kunci yang Anda berikan sudah ditempatkan di `.env.local` lokal dan **tidak ikut ter-commit** ke repository.

### Biaya

Kuota 10 permintaan/hari per pengguna, batas `maxOutputTokens`, model default, dan daftar model yang diizinkan menjaga pemakaian tetap terkendali. Model Paid hanya dipakai bila diizinkan admin atau pengguna memakai kunci sendiri. Perkiraan token output: recap ±150–250, critique ±150, ask ±200, AI import hingga 16.000.

## 3. Rekomendasi hosting server gratis

Aplikasi ini membutuhkan **disk persisten** (SQLite per pengguna). Karena itu, host platform gratis dengan filesystem sementara tidak cocok.

| Pilihan                                           | Cocok?                                                            | Keterangan                                                                                                                                                                                                                               |
| ------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Oracle Cloud Always Free — VM ARM (Ampere A1)** | **Rekomendasi utama**                                             | Gratis selamanya: 2 OCPU / 12 GB RAM, hingga 200 GB storage, 10 TB traffic/bulan. Server menyala terus. Perlu verifikasi kartu kredit (tanpa biaya bila dalam kuota). VM idle <20% selama 7 hari bisa di-reclaim. Build image ARM/arm64. |
| **Railway Free**                                  | Alternatif untuk demo                                             | $1 kredit/bulan, 1 volume 0,5 GB, domain `.up.railway.app`. Service tidur saat idle dan kredit kecil, jadi kurang cocok untuk pemakaian publik 24/7. Volume dihapus 30 hari setelah kredit habis.                                        |
| Render Free                                       | **Tidak disarankan**                                              | Filesystem sementara: SQLite hilang saat restart/redeploy, tidak ada persistent disk pada plan gratis, service tidur setelah 15 menit.                                                                                                   |
| Fly.io                                            | **Tidak ada plan gratis** untuk akun baru (trial $1/7 hari saja). | —                                                                                                                                                                                                                                        |
| Koyeb Free                                        | **Tidak cocok**                                                   | Tidak ada volume persisten.                                                                                                                                                                                                              |

### Langkah singkat di Oracle Cloud Always Free (ARM)

1. Buat akun Oracle Cloud, pilih region "home region", buat VM **Ampere A1** (Ubuntu arm64, 2 OCPU/12 GB).
2. Buka port 3000 di security list / firewall, dan siapkan domain + reverse proxy (Caddy/Nginx) untuk HTTPS.
3. Install Node 22 (mis. lewat `nvm`) dan pnpm 11.0.8.
4. `git clone https://github.com/tradingekaryan-ux/Trade-Jurnal-by-Artian-Capital-Group.git`
5. Isi environment (termasuk `OPENROUTER_API_KEYS` dan `AUTH_SECRET`) lalu `docker compose up -d` — Dockerfile akan build sesuai arsitektur ARM.
6. Backup: salin seluruh direktori `data/` (database global + per pengguna + lampiran) dan simpan `JOURNAL_SECRET`/`AUTH_SECRET` terpisah.

## 4. API yang tidak dibutuhkan

| Layanan                       | Alasan                                             |
| ----------------------------- | -------------------------------------------------- |
| Email / SMTP                  | Registrasi & login tanpa verifikasi.               |
| Payment gateway               | Aplikasi gratis.                                   |
| SMS / OTP                     | Tidak ada verifikasi.                              |
| Analytics pihak ketiga        | Sesuai prinsip upstream: tanpa tracking.           |
| Layanan kurs mata uang        | Konversi offline memakai kurs yang diisi pengguna. |
| CAPTCHA / Sentry / monitoring | Fitur opsional — **sengaja tidak ditambahkan**.    |

## Ringkasan

> Siapkan: **kunci OpenRouter (boleh banyak sebagai fallback)** + **VM dengan disk persisten** + `AUTH_SECRET`. Untuk hosting gratis, pilih **Oracle Cloud Always Free (ARM)**. Tidak perlu email, pembayaran, verifikasi, atau API opsional lainnya.
