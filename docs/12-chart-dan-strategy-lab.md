# 12 — Strategy Lab & fitur yang dihapus

## Chart & replay — DIHAPUS

Fitur chart (TradingView/Vela) dan pelacakan harga dari data feed Hyperliquid **sudah dihapus** dari aplikasi. Tidak ada halaman `/charts`, tidak ada subscription WebSocket harga, dan tidak ada replay MAE/MFE.

Penggantinya: **upload gambar opsional** pada detail trade dan pada setiap input jurnal. Gambar disimpan sebagai lampiran (`attachments`) dengan owner `trade` atau `cfd-trade`, maksimal 8 MB per file (PNG/JPEG/WebP).

## Strategy Lab — `/prop-sim`

Mengintegrasikan **`@luxalgo/prop-firm-sim-core`** (MIT) dari [`LuxAlgo/prop-firm-sim`](https://github.com/LuxAlgo/prop-firm-sim).

Input pengguna:

- Prop firm & challenge (dari direktori publik LuxAlgo, keyless)
- Win rate, average win (R), trades per day, risk per trade (%), paths, seed

Output:

- Probabilitas lulus per attempt + confidence interval, per-step pass rate
- Probabilitas funded dalam 25 attempt, biaya rata-rata, days to funded
- EV total ± standar error, P(EV > 0)
- Probabilitas payout | funded, funded blown, stagnasi
- Daftar lengkap **asumsi & batas** (`assumptions.flags`) serta provenance aturan (`directory` / `directory+inferred`)

Alur:

- `GET /api/prop-sim/firms` — mengambil direktori prop firm, di-adapt lewat `adaptFirm`, di-cache 1 jam di server.
- `POST /api/prop-sim/simulate` — menjalankan `simulate(spec, profile, options)` secara deterministik (seed sama → hasil sama).

Simulasi bukan prediksi, bukan nasihat investasi. Aturan firm dapat berubah; halaman firm tetap otoritatif.

## Dependensi baru

- `@luxalgo/prop-firm-sim-core` — ditambahkan ke `apps/web/package.json`.
- `@luxalgo/vela` sudah ada sebelumnya; kini dipakai juga untuk workspace chart, bukan hanya chart trade.

## Tidak berubah

Engine round-trip, import, analytics, Edge Score, auth, OpenRouter, dan jurnal CFD tetap seperti sebelumnya. Halaman baru hanya menambah navigasi di sidebar.
