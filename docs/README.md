# Trade Jurnal by Artian Capital Group — Dokumentasi Proyek

> **Status: dokumentasi disetujui, implementasi berjalan.** Dokumen ini adalah spesifikasi teknis sekaligus catatan keputusan yang sudah disetujui.

## Tentang proyek

Website jurnal trading **gratis, multi-pengguna**, berbasis kode open-source [`LuxAlgo/trade-journal`](https://github.com/LuxAlgo/trade-journal) (MIT). Semua fitur library tersebut dipertahankan, dengan tiga perubahan utama:

1. **Multi-pengguna**: registrasi & login **username + password saja, tanpa verifikasi email/OTP**. Data tiap pengguna terpisah.
2. **AI via OpenRouter**: seluruh fitur AI memakai OpenRouter, dengan dukungan **kunci hybrid** (global + BYOK per pengguna).
3. **Merek**: **Trade Jurnal by Artian Capital Group**.

## Keputusan yang sudah disetujui

| Keputusan                 | Pilihan                                                                                                                                                                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strategi kunci OpenRouter | **Hybrid** — kunci global dari environment sebagai default, pengguna boleh memakai kunci OpenRouter sendiri (BYOK) yang dienkripsi di server                                                                                                          |
| Model AI                  | **Katalog dinamis dari OpenRouter**: semua model ditampilkan, dibedakan **Free tier** vs **Paid tier**. Daftar diambil otomatis dari `GET /api/v1/models`, dapat di-refresh & **ditimpa manual oleh admin** bila OpenRouter mengubah status free/paid |
| Kuota AI                  | **10 permintaan per pengguna per hari**                                                                                                                                                                                                               |
| Implementasi              | **Disetujui untuk dilanjutkan**                                                                                                                                                                                                                       |

Konsekuensi teknis dari keputusan model: halaman **Admin → Model AI OpenRouter** dapat dibuka Owner/Admin (baca saja untuk Admin). **Hanya Owner** yang boleh menambah/menghapus model secara manual (satu ID per baris, contoh `openrouter/free`, `antdigital/lingdt-decision-fast-1.0:free`, `fish-audio/s2.1-pro-free:free`), menyinkron dari OpenRouter, mengubah kuota/default, dan mengelola **10 slot kunci API fallback** (terenkripsi di Supabase, bisa diganti/dihapus). Admin tidak memiliki akses ke fitur ini. Pengguna biasa memilih model dari katalog yang sudah difilter owner.

## Daftar dokumen

| Dokumen                                                             | Isi                                                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [01 — Ringkasan eksekutif](01-ringkasan-eksekutif.md)               | Tujuan, ruang lingkup, prinsip                                            |
| [02 — Arsitektur sistem](02-arsitektur.md)                          | Stack, struktur monorepo, desain multi-tenancy, alur request              |
| [03 — Daftar fitur](03-daftar-fitur.md)                             | Pemetaan **semua** fitur upstream + status pelaksanaannya                 |
| [04 — Autentikasi & multi-pengguna](04-autentikasi-dan-pengguna.md) | Registrasi, login, session, isolasi data, kuota 10/hari                   |
| [05 — Integrasi OpenRouter](05-integrasi-openrouter.md)             | Kunci hybrid, katalog model dinamis Free/Paid, panel admin, kontrol biaya |
| [06 — API yang dibutuhkan](06-api-yang-dibutuhkan.md)               | Daftar kunci/API yang harus disiapkan                                     |
| [07 — Model data](07-model-data.md)                                 | Database global + per pengguna: users, sessions, ai_usage, katalog model  |
| [08 — Rencana implementasi](08-rencana-implementasi.md)             | Tahapan kerja, kriteria penerimaan, risiko                                |
| [09 — Deployment & legalitas](09-deployment-dan-legalitas.md)       | Hosting, environment, backup, atribusi MIT & trademark                    |
| [10 — Deployment Northflank](10-deployment-northflank.md)           | Panduan deploy pilihan: combined service, volume `/data`, environment     |
| [11 — CFD journal](11-cfd-journal.md)                               | Sistem jurnal CFD: lot, pips, mode instrumen, running/closed, statistik   |
| [12 — Strategy Lab & fitur dihapus](12-chart-dan-strategy-lab.md)   | Simulator prop firm; chart/feed dihapus, diganti upload gambar            |
| [13 — Promo, Role & Discord](13-promo-role-discord.md)              | Promo & idea, role owner/admin/member, badge verifikasi, tombol Discord   |
| [14 — Supabase & imgdb.io](14-supabase-imgdb.md)                    | Data di Supabase Postgres, gambar di imgdb.io, akun owner                 |
| [15 — Penghapusan & profil](15-deletion-dan-profile.md)             | Cascade delete, halaman profil foto/banner/bio, catatan hosting           |
| [16 — Konsistensi analytics](16-consistensi-analytics.md)           | Penyatuan daily journal/trades dengan jurnal CFD/Futures/Crypto/Stock     |
| [17 — Ranking & data member](17-ranking-dan-admin-data.md)          | Data member di admin, leaderboard publik, sertifikat PDF, urutan sidebar  |
