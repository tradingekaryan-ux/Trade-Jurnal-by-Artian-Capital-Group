# Market data & replay — DIHAPUS

> Fitur data feed harga, chart, dan replay **sudah dihapus**. Tidak ada koneksi Hyperliquid untuk price tracking, tidak ada halaman chart, dan tidak ada estimasi MAE/MFE dari candle. Penggantinya adalah upload gambar opsional pada entri jurnal/detail trade. Dokumen lama di bawah disimpan sebagai referensi arsitektur historis saja.

# (Arsip) Historical market data

Data feed harga dan chart memakai **satu-satunya penyedia live: Hyperliquid HIP-3**, dibatasi pada **indeks, komoditas, dan forex**. Penyedia lain (Alpaca, Binance, Coinbase, OANDA, London Strategic Edge) **tidak dipakai**. File CSV lokal tetap tersedia sebagai cadangan offline, bukan sebagai data feed.

Tidak ada API key yang dibutuhkan: endpoint `https://api.hyperliquid.xyz/info` bersifat publik.

## Menghubungkan & memakai

1. Buka **Settings → Market data**, aktifkan **Hyperliquid TradFi** (**Enable**), lalu **Test connection**. Tidak ada kredensial yang diisi.
2. Buka trade yang sudah ditutup. Pilih provider **Hyperliquid TradFi**, simbol dari daftar, dan resolusi (`1m`, `5m`, `15m`, `1h`, `1d`).
3. Klik **Load market data**. Vela merender candle, replay mendukung restart/play/pause/step/speed/scrub. Membuka trade **tidak** otomatis meminta data harga.
4. Centang opsi perhitungan hanya bila instrumen, basis harga, dan mata uang sudah sesuai; estimasi MAE/MFE monetari akan tersimpan untuk Reports.

Sebelum candle dimuat, chart menampilkan path dari execution yang tercatat.

## Simbol yang didukung

Nama HIP-3 bersifat **lengkap (`dex:ticker`) dan case-sensitive**. Daftar ini juga menjadi validasi server — simbol di luar daftar ditolak tanpa permintaan jaringan.

| Kategori                    | Simbol                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Indeks**                  | `xyz:SP500`, `xyz:XYZ100`, `xyz:JP225`, `xyz:KR200`, `xyz:NIFTY`                                                          |
| **Komoditas**               | `xyz:GOLD`, `xyz:SILVER`, `xyz:COPPER`, `xyz:PLATINUM`, `xyz:PALLADIUM`, `xyz:CL`, `xyz:BRENTOIL`, `xyz:NATGAS`, `xyz:HO` |
| **Forex**                   | `xyz:EUR`, `xyz:JPY`, `xyz:GBP`                                                                                           |
| **US Stock / ETF (HIP-3)**  | `xyz:NVDA`, `xyz:MSFT`, `xyz:MU`, `xyz:INTC`, `xyz:TSLA`, `xyz:SPCX`, `xyz:SKHX`, `xyz:SOXL`, `xyz:SMH`                   |
| **Crypto perpetual (core)** | `BTC`, `ETH`, `SOL`, `HYPE`, `XRP`, `DOGE`                                                                                |
| **Crypto spot**             | `PURR/USDC`                                                                                                               |

Pre-IPO dan rates tidak dimasukkan. Harga HIP-3 adalah perpetual yang mengikuti oracle venue, bukan spot atau kontrak pengiriman fisik; riwayat hanya tersedia sejak market tersebut diluncurkan.

## Arti MAE / MFE

MAE/MFE adalah **estimasi ekskursi ekuitas posisi kotor** selama siklus posisi tertutup, relatif terhadap nol saat entry. Setiap observasi menjumlahkan arus kas execution bertanda plus nilai posisi yang tersisa, dikalikan multiplier kontrak yang dikonfigurasi. Partial exit dan scale-in diperhitungkan. MAE adalah Magnitude negatif terbesar; MFE adalah nilai positif terbesar. Fee dan konversi mata uang tidak termasuk. Angka ini dihitung sesuai permintaan dan **tidak mengubah** execution, P&L realisasi, maupun metrik dashboard.

High/low hanya diambil dari candle lengkap saat posisi tidak berubah; candle yang memotong entry, exit, atau partial fill dikecualikan, sehingga estimasi bisa lebih kecil dari ekskursi sebenarnya. Tidak ada angka bila coverage tidak lengkap, riwayat terpotong, multiplier wajib tidak ada, atau basis harga belum dikonfirmasi. Opsi tidak didukung. Harga USDC diperlakukan sebagai USD; tidak ada konversi FX.

Replay menampilkan candle yang sudah selesai sesuai posisi cursor; candle masa depan dan label execution belum muncul. Ini playback review, bukan simulasi tick.

## Arsitektur

| File                                       | Peran                                   |
| ------------------------------------------ | --------------------------------------- |
| `lib/market-data.ts`                       | Kontrak candle UTC, resolusi, dan hasil |
| `lib/market-providers.ts`                  | Katalog penyedia + daftar simbol tradfi |
| `server/market-data/provider.ts`           | Antarmuka adapter                       |
| `server/market-data/connections.ts`        | Registry koneksi (Hyperliquid + CSV)    |
| `server/market-data/hyperliquid.ts`        | Adapter HIP-3 `candleSnapshot`          |
| `server/market-data/transport.ts`          | Rate limit, cache, dedup, abort         |
| `lib/excursions.ts`, `lib/trade-replay.ts` | Kalkulasi & potongan chart              |
| `components/trade-market-data.tsx`         | Kontrol UI & Vela                       |

Permintaan dikirim dari server sebagai `POST /info` dengan body:

```json
{
  "type": "candleSnapshot",
  "req": { "coin": "xyz:GOLD", "interval": "1h", "startTime": 0, "endTime": 0 }
}
```

Respons `t/o/h/l/c/v` (harga berupa string) dinormalisasi menjadi OHLCV UTC ascending. Redirect ditolak, error upstream tidak diteruskan apa adanya, dan kredensial tidak pernah dikirim ke browser.

## Batas permintaan

- Hyperliquid menyediakan maksimal **5.000 candle per respons**; adapter membagi rentang menjadi window dan menandai riwayat sebagai `truncated` bila batas 80 halaman atau 20.000 candle tercapai.
- Transport membatasi 6 request aktif per proses, 2 per host, antar-request minimal 350 ms, dan 64 antrean. Request identik bersama dalam satu in-flight. Cache memory 5 menit untuk Riwayat lama, 15 detik untuk data terbaru, maksimal 128 respons / 16 MiB.
- Resolusi yang tersedia: `1m`, `5m`, `15m`, `1h`, `1d`. Timeframe lain tidak ditawarkan di UI.
- Status koneksi tidak memuat kunci (tidak ada kunci). Endpoint tetap dilindungi oleh sesi login aplikasi.

## Cadangan CSV lokal

Jika candle HIP-3 tidak mencakup periode trade, unggah file OHLCV di **Settings → Market data → Market data CSV**. Format: `time,open,high,low,close,volume`, satu instrumen/resolusi per file, maksimal 5 MB / 50.000 baris. `time` boleh ISO-8601 UTC, Unix detik, atau Unix milidetik. Data disimpan lokal, tidak termasuk ekspor jurnal, dan harus ikut dibackup terpisah.

## Referensi

- [Hyperliquid Info endpoint — candleSnapshot](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint)
- [HIP-3 market names](https://markets.xyz/docs/trading-api-hip-3-markets)
