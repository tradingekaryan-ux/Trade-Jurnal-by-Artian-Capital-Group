# 17 — Data member di Admin, Ranking & Sertifikat

## Data member di `/admin`

Owner dan Admin bisa membaca seluruh data akun lewat tabel **Data seluruh member** → **Lihat data**. Detail menampilkan:

- **Trade**: seluruh baris `cfd_trades` milik akun (detail lengkap, termasuk entry/exit, PnL, status, catatan).
- **Jurnal & Edge**: Edge Score global dan per jurnal (CFD, Futures, Crypto Spot, Crypto Perpetual, US Stock), metrik lengkap (`computeMetrics`) dan komponen Edge.
- **Notebook**: catatan + folder dari snapshot.
- **Playbook**: daftar playbook beserta aturannya.
- **Progress**: rutinitas dan checklist.
- **Missed trades**: daftar trade yang terlewat.
- **Postingan**: promo & trade idea milik akun.

Sumbernya Supabase: `cfd_trades`, `promos`, `journal_snapshots.payload`. Edge Score dihitung ulang dari data, disimpan di `server/ranking.ts` (formulir v2, minimum 5 trade selesai).

## Ranking publik `/ranking`

- Dapat diakses tanpa login (`/ranking` dan `/api/ranking` termasuk public path di middleware).
- Satu entri per akun: **nama jurnal** + **nama pemilik**, Edge Score, jumlah trade, win rate, net P&L, profit factor.
- Detail per jurnal bisa dibuka dari tombol **Detail**.
- Nama jurnal diatur di **Profile → Nama jurnal** (kolom `profiles.journal_name`, default `Jurnal <username>`).

Peringkat dihitung ulang dari Supabase pada setiap permintaan, sehingga berubah ketika ada trade baru.

## Sertifikat ranking (PNG)

Tombol **Sertifikat** membuka panel pilihan ukuran (**1920×1080** atau **1080×1080**) lalu mengunduh **PNG** yang dirender di browser:

- Peringkat saat unduhan, total peserta, nama jurnal, pemilik, dan Edge Score.
- Statistik: trade selesai, win rate, net P&L, profit factor.
- **Tanggal dan jam unduhan (UTC) dicetak**, lengkap dengan catatan bahwa peringkat dapat berubah.
- Di kiri bawah: tanda tangan **Eka Ryan** memakai font `Allura` + nama cetak **Pt. Eka Ryan M.**
- Di kanan bawah: barcode Code128 yang mengarah ke alamat website, disertai teks URL.

Tidak ada lagi endpoint PDF untuk sertifikat ranking — semua berjalan offline di browser.

## Urutan navigasi sidebar

Urutan standarworkspace: Dashboard → jurnal trading (CFD, Futures, Crypto, Stock) → Calendar → Daily journal → Trades → Notebook → Playbooks → Progress → Missed trades → Reports → Strategy lab → Prop firms → Ranking → Promo → Trades Idea → Profile → pemisah → Import, Accounts, Settings. Active state kini hanya menyorot satu menu (`isNavActive`), mis. `/journal/[date]` menyorot Daily journal tanpa ikut menyorot CFD/Futures.
