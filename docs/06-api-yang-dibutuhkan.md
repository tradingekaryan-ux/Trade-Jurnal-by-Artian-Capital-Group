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

## 3. Hosting yang dipakai: Northflank

**Keputusan: Northflank Sandbox (Free).** Aplikasi tidak perlu diubah — Dockerfile sudah menyediakan port `3000` dan direktori `/data` untuk persistent volume.

| Item        | Nilai                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| Service     | Combined service dari GitHub (branch `main`), build Dockerfile, engine BuildKit                       |
| Volume      | Persistent volume di-mount ke `/data`, `ReadWriteOnce`, 1 instance                                    |
| Environment | `OPENROUTER_API_KEYS`, `AUTH_SECRET`, `SITE_URL`, `JOURNAL_DATA_DIR=/data`, opsional `JOURNAL_SECRET` |
| Biaya       | Sandbox: hingga $20/bulan resource, always on; volume tetap ditagih walau service mati                |

Panduan lengkap: [`10-deployment-northflank.md`](10-deployment-northflank.md).

### Alternatif lain (tidak dipilih)

| Pilihan                               | Keterangan                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| Railway Free                          | $1/bulan, volume 0,5 GB, service tidur saat idle; cocok untuk demo, bukan 24/7  |
| AWS EC2 t2/t3.micro / Google e2-micro | x86, gratis 12 bulan / kuota always-free, tetapi perlu konfigurasi VM sendiri   |
| Oracle Cloud Always Free              | ARM; **tidak dipakai** sesuai keputusan                                         |
| Render Free / Koyeb Free / Fly.io     | Tidak cocok: tanpa disk persisten atau tidak ada plan gratis                    |
| Cloudflare Workers/Pages              | Bisa, tapi butuh port besar ke D1/R2 (better-sqlite3 tidak berjalan di Workers) |

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
