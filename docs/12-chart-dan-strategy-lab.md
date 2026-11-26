# 12 — Chart Vela & Strategy Lab (prop-firm simulator)

## Chart Vela — `/charts`

Halaman chart penuh memakai **`@luxalgo/vela/workspace`** dengan provider data khusus yang menerjemahkan simbol tradfi Hyperliquid (`xyz:GOLD` → `GOLD`) ke API internal aplikasi.

- Data candle: `GET /api/market-data/chart?symbol=<TICKER>&timeframe=<1|5|15|60|1D>&from=&to=`
- Provider server: `server/market-data/hyperliquid.ts` (endpoint publik `candleSnapshot`, tanpa API key).
- Instrument: **FOREX, COMMODITY, INDICE, US Stock (HIP-3), crypto perpetual, dan crypto spot** dari katalog Hyperliquid (lihat [`market-data.md`](market-data.md)).
- Panel **Input trade ke jurnal**: pilih jurnal tujuan (CFD / Crypto / US Stock / Manual; Futures coming soon), harga terakhir bisa diambil langsung dari chart, lalu simpan.
- Fitur workspace Vela: timeframe, 70+ indikator bawaan, drawing tools, layout, object tree, status line, timezone, dan state tersimpan di `localStorage` (`trade-jurnal-vela`).
- Atribusi **Vela™** wajib tetap tampil sesuai Apache-2.0 / NOTICE — jangan disembunyikan tanpa pengganti yang setara.

Batas: Hyperliquid hanya menyediakan ~5.000 candle terbaru per interval; riwayat sangat tua tidak tersedia. Chart bersifat live/recent-history, bukan backfill dalam.

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
