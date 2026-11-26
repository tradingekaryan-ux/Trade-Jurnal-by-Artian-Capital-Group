# 06 — API yang dibutuhkan

Berikut daftar lengkap kunci/API yang perlu Anda siapkan. **Hanya satu yang wajib** untuk menjalankan aplikasi sesuai permintaan.

## 1. Wajib

| #   | API / Kredensial                               | Fungsi                                                                                      | Cara mendapatkan                                                                     | Catatan penting                                                                                                                                                                              |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **OpenRouter API key** (`OPENROUTER_API_KEY`)  | Seluruh fitur AI: ringkasan sesi, kritik trade, "ask your journal", dan AI statement import | Daftar di [openrouter.ai](https://openrouter.ai), buat API key, **isi saldo/kredit** | Diletakkan di environment server (atau `.env.local` / Docker env). Jangan pernah ditaruh di kode frontend. Jika memilih opsi BYOK, kunci per pengguna menggantikan/ melengkapi kunci global. |
| 2   | **Lingkungan hosting** (bukan API, tapi wajib) | Menjalankan aplikasi                                                                        | Node.js **22+**, pnpm **11.0.8**, disk persisten untuk SQLite                        | Bisa VPS, Docker, Railway/Fly.io dengan volume. Platform serverless **tanpa disk tidak didukung** oleh desain SQLite ini. Domain + HTTPS disarankan untuk cookie `Secure`.                   |

### Tentang biaya OpenRouter

- Kunci ini **dipakai server**, bukan oleh pengunjung (kecuali opsi BYOK dipilih).
- Anda menanggung biaya token untuk pengguna yang memakai kunci global. Karena itu implementasi menyertakan: kuota **10 permintaan/hari per pengguna** (dapat diubah admin), model default, daftar model yang diizinkan, dan `maxOutputTokens`.
- Kunci OpenRouter juga bisa diisi sendiri oleh pengguna (BYOK); kunci tersimpan terenkripsi dan hanya dikirim ke OpenRouter.
- Perkiraan pemakaian: recap ±150–250 token_output, critique ±150, ask ±200, AI import hingga 16.000 token_output per dokumen.
- Variabel pendukung: `AUTH_SECRET` (wajib di produksi, untuk cookie), `SITE_URL`, `OPENROUTER_BASE_URL`, `JOURNAL_SECRET`, `ADMIN_USERNAME`.

## 2. Opsional — kredensial milik pengguna (BYO, dienkripsi di server)

Fitur ini tetap aktif tanpa kunci global; pengguna memasukkan kredensial mereka sendiri lewat UI Settings. Aplikasi **tidak** membutuhkan kunci Anda untuk ini.

| Fitur                    | Penyedia / kredensial yang didukung                                                                                                                                                                                             | Keterangan                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Broker sync**          | Alpaca, Binance, Bybit, Coinbase, Kraken, OKX, Tradier, IBKR Flex, Hyperliquid, Questrade, Topstep, Trading212, Webull, Crypto.com, E*TRADE, Public, Charles Schwab, TradeStation, tastytrade, Robinhood Crypto, Gemini, KuCoin | Read-only via `@luxalgo/broker-sdk`. Kredensial dienkripsi AES-256-GCM di database.                                                                              |
| **Market data / replay** | London Strategic Edge, Alpaca, OANDA, Binance, Coinbase, atau unggah candle CSV                                                                                                                                                 | Untuk estimasi MAE/MFE & replay. Tanpa koneksi, chart tetap menampilkan fill yang tercatat. Bisa memakai CSV gratis, jadi **tidak wajib** berlangganan provider. |

## 3. Opsional — fitur bawaan tanpa kunci

| Fitur                                    | Keterangan                                                                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Voice dictation** (jurnal harian)      | Memakai `SpeechRecognition` bawaan browser (Chrome/Edge). **Tanpa API key**, tetapi dukungan & kualitas tergantung browser/vendor. |
| **Konversi mata uang**                   | Kurs statis yang diisi pengguna; **offline**, tanpa layanan kurs.                                                                  |
| **Import pernyataan standar**            | 16+ format CSV/HTML/XML/XLSX diparse lokal; **tanpa API**.                                                                         |
| **Chart, replay, analytics, Edge Score** | Semua berjalan lokal di server Anda.                                                                                               |

## 4. API yang TIDAK dibutuhkan

| Layanan                                  | Alasan                                                                |
| ---------------------------------------- | --------------------------------------------------------------------- |
| Email / SMTP (Mailgun, Resend, SMTP)     | Registrasi & login **tanpa verifikasi**, jadi tidak ada email keluar. |
| Payment gateway (Stripe, Midtrans, dll.) | Aplikasi **gratis**, tidak ada pembayaran.                            |
| SMS / OTP                                | Tidak ada verifikasi apa pun.                                         |
| Analytics pihak ketiga                   | Sesuai prinsip upstream: tanpa layanan analitik/tracking.             |
| Layanan kurs mata uang                   | Konversi memakai kurs buatan pengguna, offline.                       |
| Google Maps / geolocation                | Tidak dipakai.                                                        |

## 5. Opsional — hanya bila dibutuhkan kemudian

| Layanan                          | Kapan diperlukan                                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Turnstile / hCaptcha / reCAPTCHA | Bila registrasi gratis diserang bot/spam. Menambah satu kunci API; tidak direkomendasikan pada tahap awal. |
| Sentry / monitoring              | Bila ingin alert error produksi. Tidak termasuk dalam fitur inti.                                          |

## Ringkasan untuk Anda

> **Yang harus Anda siapkan sekarang: satu (1) OpenRouter API key dengan saldo, plus server Node 22 dengan disk persisten.**
> Kredensial broker dan market data bersifat opsional dan diisi sendiri oleh pengguna. Tidak perlu email, pembayaran, atau API verifikasi.

Sebelum implementasi, konfirmasikan juga tiga hal terkait kunci OpenRouter (lihat [`README.md`](README.md#keputusan-yang-perlu-anda-konfirmasi-sebelum-implementasi)):

1. Kunci global / BYOK / hybrid.
2. Model default & daftar model yang diizinkan.
3. Kuota harian per pengguna.
