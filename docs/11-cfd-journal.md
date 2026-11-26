# 11 — CFD journal (sistem jurnal baru)

Sistem jurnal baru berorientasi CFD, berjalan **berdampingan** dengan engine round-trip upstream (import/manual lama tetap ada). Tujuannya: input singkat dan kalkulasi profit yang sesuai dengan cara trader CFD/forex mencatat trade.

## Perubahan konsep

| Lama                            | Baru                                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| `Quantity`                      | **Lot** / ukuran posisi                                                                  |
| Simbol bebas                    | **FOREX, COMMODITY, INDICE** dengan ticker CFD standar (mis. `XAUUSD`, `EURUSD`, `US30`) |
| Hanya P&L dari price difference | **Pips / point / tick + USD per pip per lot**, atau persentase                           |
| Entry + exit execution          | Entry, Side, Take Profit, Stop Loss, Exit/Result                                         |

## Mode jurnal

Pengguna memilih mode saat membuat trade:

| Mode                                | Kalkulasi                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| **CFD (Pips)**                      | `pips = arah × (exit − entry) / pipSize`; `P&L = pips × USD_per_pip × lot`   |
| **Futures (Tick)**                  | `ticks = arah × (exit − entry) / tickSize`; `P&L = ticks × nilai_tick × lot` |
| **Crypto Spot (%)**                 | Input = **nominal masuk USD**; `P&L = nominal × (exit − entry)/entry`        |
| **Crypto Perpetual (% × Leverage)** | Input = **nominal setelah leverage (USD)**; `P&L = nominal × persentase`     |
| **US Stock Spot (%)**               | Input = **nominal masuk USD** (mis. beli $100); `P&L = nominal × persentase` |

Untuk crypto dan US Stock **tidak ada parameter lot** — field yang dipakai adalah **size nyata** (jumlah koin atau lembar saham). Notional dihitung otomatis dari `size × entry`. API juga menerima `size` sebagai alias input.

**Futures (Tick)** sudah aktif dengan kontrak standar, mini, micro, dan nano.

## Empat jurnal terpisah

| Halaman            | Mode                                              | Instrument                                               | Parameter utama                                    |
| ------------------ | ------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------- |
| `/journal/cfd`     | CFD (Pips)                                        | FOREX, COMMODITY, INDICE                                 | Lot, pip size, USD per pip per lot                 |
| `/journal/futures` | Futures (Tick)                                    | ES, NQ, MES, MNQ, MRTY, MGC, MCL, SPXN, NQ100N, …        | Kontrak, tick size, USD/tick                       |
| `/journal/crypto`  | Crypto Spot (%) + Crypto Perpetual (% × Leverage) | BTCUSD, ETHUSD, SOLUSD, BTCUSDT, ETHUSDT, …              | Nominal USD (spot) / nominal pasca-leverage (perp) |
| `/journal/stock`   | US Stock Spot (%)                                 | NVDA, MSFT, AAPL, TSLA, MU, INTC, AMD, META, GOOGL, AMZN | Nominal masuk USD, persentase                      |

URL lama `/cfd-journal` otomatis mengarah ke `/journal/cfd`. API `GET /api/cfd-journal?mode=...` menyaring daftar sesuai jurnal.

`USD per pip per lot` berisi default per instrumen (mis. EUR/USD = $10 untuk 1 lot standar) dan **bisa di-override** oleh pengguna di form. Nilai default adalah referensi risk sizing, bukan data broker — pengguna wajib mencocokkan dengan spesifikasi kontrak firm/broker mereka.

## Gambar opsional

Setiap input jurnal dan detail trade memiliki **upload gambar opsional** (PNG/JPEG/WebP, maks. 8 MB/file). Gambar diunggah setelah entri tersimpan dan ditampilkan sebagai thumbnail. Tidak wajib diisi.

## Input & status

Field: **Entry, Side, Take Profit, Stop Loss**, Lot, Exit, sumber hasil, dan catatan.

- **Running trade**: Exit dan hasil dikosongkan → status `running`, `P&L = null`.
- **Closed trade**: mengisi Exit (auto) **atau** Result manual / Breakeven → status otomatis berubah menjadi `closed`.
- **Result manual** dipakai untuk close manual atau hasil yang berasal dari broker; aplikasi tetap menghitung pips setara untuk statistik.
- **Breakeven** menghasilkan `P&L = 0` tapi tetap dihitung sebagai trade tertutup.

Rasio **R:R** dihitung dari SL/TP bila keduanya diisi; **R multiple** dari jarak stop. Keduanya tampil di preview sebelum menyimpan.

## Statistik "institutional grade"

Panel statistik pada halaman `/cfd-journal` menampilkan: total trade, running/closed, win rate, total P&L, total pips/poin, profit factor, expectancy, dan rata-rata R multiple. Semua dihitung dari trade yang tersimpan, bukan dari data pihak ketiga.

## Penyimpanan

Tabel baru `cfd_trades` di database per pengguna (`data/users/<id>.db`), dibuat otomatis oleh bootstrap SQLite. Tidak mengubah tabel `trades`/`executions` upstream, sehingga import, analytics, Edge Score, dan fitur lama tetap berfungsi.

API: `GET/POST/PATCH/DELETE /api/cfd-journal`. PATCH dipakai untuk menutup trade running.

## AI import untuk platform CFD

Prompt parsing statement AI di [`apps/web/src/server/ai-import.ts`](../apps/web/src/server/ai-import.ts) kini secara eksplisit memahami:

- **MetaTrader 4** (HTML "Historical trades": Time, Symbol, Type, Volume/lots, Price, SL, TP, Profit, Swap, Commission)
- **MetaTrader 5** (deals HTML/CSV: deal buy/sell + entry/exit markers, Volume, Price, Swap, Commission)
- **cTrader** (Trade ID/Position ID, Direction, Volume, Open/Close Time & Price, Profit, Swap, Commission)
- Platform CFD lain (DXTrade, Match-Trader, TradingView paper/strategy, CSV/HTML generik) dengan pencocokan kolom berdasarkan **makna**, bukan nama header persis.

Aturan tetap: file adalah data yang tidak dipercaya, fee = commission + swap, tidak mengarang harga dari P&L, dan trade-level row direkonstruksi menjadi dua fill dengan peringatan.

## Dibandingkan dengan fitur lama

| Fitur lama                        | Status                                                                   |
| --------------------------------- | ------------------------------------------------------------------------ |
| Import file 16+ format            | Tetap ada, AI kini lebih spesifik untuk MT4/MT5/cTrader/CFD              |
| Broker sync                       | **Tab di halaman Import dihapus** — hanya File upload dan Manual         |
| Round-trip, analytics, Edge Score | Tetap ada untuk data lama                                                |
| Chart & replay                    | **Dihapus** — penggantinya upload gambar opsional di jurnal/detail trade |
