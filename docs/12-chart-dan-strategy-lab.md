# 12 — Chart TradingView & Strategy Lab (prop-firm simulator)

## Chart TradingView — `/charts`

Halaman chart memakai **TradingView Lightweight Charts** (`lightweight-charts`) yang diberi data candle **Hyperliquid**, bukan Vela workspace.

- Data awal: `GET /api/market-data/chart?symbol=<coin>&timeframe=<1m|5m|15m|1h|1d>&from=&to=`
- **Realtime**: WebSocket `wss://api.hyperliquid.xyz/ws` dengan subscription `{ type: "candle", coin, interval }`. Jika socket gagal, aplikasi fallback polling REST setiap 15 detik. Status live/polling ditampilkan di toolbar.
- Filter kategori pair (Semua / Forex / Komoditas / Indeks / US Stock / Crypto Perp / Crypto Spot) memakai katalog `HYPERLIQUID_TRADFI_SYMBOLS`, sehingga setiap kategori berisi simbol.
- Instrument dan timeframe **hanya dipilih di toolbar chart** — tidak ada input terpisah di panel trade.
- Panel **Input trade ke jurnal** memakai simbol & waktu dari chart, tombol **Pakai harga chart**, lalu menyimpan ke jurnal CFD / Crypto / US Stock / Manual (Futures coming soon).
- Vela tetap dipakai untuk chart trade detail bawaan upstream; atribusi Vela™ di halaman tersebut tetap tampil.

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
