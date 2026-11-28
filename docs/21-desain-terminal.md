# 21 — Bahasa visual terminal trading

UI sengaja diarahkan ke **terminal eksekusi**, bukan kartu marketing generik:

- **Hairline & sudut tajam** — border 1px, radius 2–3px, tanpa shadow tebal atau gradien dekoratif.
- **Micro-label uppercase** — 9–10px, `letter-spacing` 0.11–0.16em, warna `muted-foreground`.
- **Angka monospace tabular** — `ui-monospace` + `font-variant-numeric: tabular-nums` supaya kolom harga/rata-rata sejajar.
- **Warna hanya untuk state** — hijau = profit/buy, merah = loss/sell, biru brand = fokus/link. Tidak ada warna sebagai satu-satunya penanda.
- **Tidak ada emoji, ilustrasi stok, atau gradient blob.**

## Execution desk (form jurnal)

Halaman `/journal/cfd`, `/journal/futures`, `/journal/crypto`, `/journal/stock` memakai panel yang sama:

1. **Header** — mode, arah (BUY/SELL), status (CLOSED/RUNNING), instrument.
2. **01 · Instrumen & arah** — mode, instrument, waktu buka, toggle BUY/LONG vs SELL/SHORT.
3. **02 · Parameter order** — size, entry, SL, TP, exit, sumber hasil, manual P&L, leverage/USD-per-pip bila relevan. Quick button **1R / 2R / 3R** mengisi TP dari jarak entry→SL.
4. **03 · Bukti order** — upload screenshot.
5. **Order preview (rail kanan)** — estimasi P&L, pips/poin, R:R, R multiple, spesifikasi tick.
6. **Footer** — pesan status + tombol `KIRIM ORDER · SIMPAN TRADE`.

## Statistik & quote

- Ringkasan jurnal ditampilkan sebagai **terminal tape** (sel-sel hairline, angka monospace), bukan 8 kartu terpisah.
- Quote dashboard menjadi **DESK NOTE ticker**: border kiri aksen brand, label uppercase, tanpa italik/gelembung bicara. Rotasi tetap 3 detik dan bisa diatur owner.

Semua gaya berada di `apps/web/src/app/globals.css` pada blok `Trading terminal surface` dan `Desk note`.
