# 01 — Ringkasan eksekutif

## Tujuan

Menyediakan **website jurnal trading yang gratis dan terbuka untuk siapa saja**, dengan kualitas fitur setara aplikasi berbayar, namun tetap ringan dan mandiri (self-hosted). Basis kode diambil dari proyek MIT [`LuxAlgo/trade-journal`](https://github.com/LuxAlgo/trade-journal) yang sudah memiliki mesin analitik, importir pernyataan broker, kalender P&L, jurnal harian, dan reflection AI.

## Nama & identitas

- **Nama aplikasi:** Trade Jurnal by Artian Capital Group
- **Judul halaman / metadata:** `Trade Jurnal by Artian Capital Group`
- **Deskripsi:** Jurnal trading gratis — sinkron broker, impor pernyataan, analitik mendalam, kalender P&L, jurnal harian, dan refleksi AI via OpenRouter.
- **Tema:** gelap-terutama (dark-first), dengan mode terang, mengikuti sistem desain upstream.

## Ruang lingkup perubahan terhadap upstream

| Aspek       | Upstream                                         | Proyek ini                                                                |
| ----------- | ------------------------------------------------ | ------------------------------------------------------------------------- |
| Pengguna    | Satu pengguna, opsional `JOURNAL_PASSWORD`       | Multi-pengguna: registrasi & login username/password                      |
| Verifikasi  | Tidak ada                                        | **Tidak ada** (sesuai permintaan): langsung bisa pakai setelah registrasi |
| Penyimpanan | Satu database SQLite lokal                       | Database global + satu database SQLite per pengguna (isolasi penuh)       |
| AI          | Anthropic / OpenAI / OpenAI-compatible (BYO key) | **OpenRouter saja** (satu gateway, banyak model)                          |
| Kunci AI    | Disimpan per pengguna di Settings                | Global dari environment (disarankan) atau BYOK opsional                   |
| Merek       | LuxAlgo Trade Journal                            | Trade Jurnal by Artian Capital Group                                      |
| Fitur lain  | Semua ada                                        | **Semua dipertahankan**                                                   |

## Prinsip

1. **Semua fitur upstream tetap ada.** Tidak ada penghapusan fitur; perubahan hanya pada lapisan identitas, multi-tenancy, dan penyedia AI.
2. **Data pengguna terisolasi.** Pengguna A tidak boleh melihat/mengubah data pengguna B, termasuk lampiran, pengaturan, dan kunci kredensial.
3. **Tanpa verifikasi apa pun.** Tidak ada email, OTP, atau tautan aktivasi. Diperlukan perlindungan dasar (hash password, rate limit, batas kuota) sebagai gantinya.
4. **Biaya terkendali.** AI memakai batas token keluaran, daftar model yang diizinkan, dan kuota per pengguna.
5. **Portabel & transparan.** SQLite di disk, ekspor CSV/JSON/PDF/PNG, metrik open-source, atribusi MIT tetap dicantumkan.

## Yang TIDAK dilakukan

- Tidak menambah layanan email, pembayaran, atau analitik pihak ketiga (tidak dibutuhkan untuk "gratis").
- Tidak mengubah rumus Edge Score, round-trip engine, atau parser importer — ini diambil apa adanya dari `@luxalgo/journal-core` dan `@luxalgo/journal-importers`.
- Tidak menyimpan kunci API dalam bentuk plain teks; kunci dienkripsi AES-256-GCM.

## Status saat ini

Dokumentasi selesai. Implementasi menunggu persetujuan Anda dan konfirmasi empat keputusan di [`README.md`](README.md#keputusan-yang-perlu-anda-konfirmasi-sebelum-implementasi).
