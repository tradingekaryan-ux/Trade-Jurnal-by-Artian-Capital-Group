# 09 — Deployment & legalitas

## Deployment

> **Hosting yang dipakai: Northflank Sandbox (Free).** Panduan lengkap ada di [`10-deployment-northflank.md`](10-deployment-northflank.md). Bagian di bawah tetap berlaku sebagai prinsip umum.

### Kebutuhan

- **Node.js 22+**, **pnpm 11.0.8**
- **Disk persisten** untuk direktori data (SQLite + lampiran + kunci enkripsi)
- Domain dengan HTTPS (disarankan agar cookie `Secure` aktif)
- Variabel lingkungan wajib: `OPENROUTER_API_KEY`, `AUTH_SECRET`; disarankan: `SITE_URL`; opsional: `JOURNAL_SECRET`, `JOURNAL_DATA_DIR`, `OPENROUTER_BASE_URL`, `OPENROUTER_MODEL`, `ADMIN_USERNAME`. Daftar model & kuota dikelola di `/admin`, bukan lewat env.
- **Jangan pernah** mengaktifkan `AUTH_DISABLED=1` di produksi (hanya untuk tes).

### Docker Compose (prinsip)

- Satu service web (Next.js), satu volume bind ke `./data` di host.
- Port `3000`, reverse proxy (Caddy/Nginx) untuk HTTPS.
- `JOURNAL_DATA_DIR=/app/data` di dalam container.
- Kunci rahasia di `.env` host, **tidak** di-commit ke git.

### Perintah dasar

```
pnpm install --frozen-lockfile
pnpm dev        # pengembangan, http://localhost:3000
pnpm preview    # build + jalankan versi produksi
pnpm test       # seluruh tes
pnpm typecheck  # cek tipe
pnpm build      # build produksi
```

### Backup & restore

- Backup: hentikan aplikasi, salin **seluruh** direktori `JOURNAL_DATA_DIR` (termasuk file tersembunyi `.secret` dan lampiran).
- Simpan nilai `JOURNAL_SECRET` terpisah; tanpa itu kredensial terenkripsi tidak dapat dibaca setelah restore.
- File kunci BYOK pengguna ikut ter-backup di database dalam bentuk terenkripsi.
- Ekspor JSON pengguna **tidak** memuat kredensial, dataset candle, estimasi, atau biner lampiran — sesuai perilaku upstream.

## Legalitas & atribusi

| Aspek          | Ketentuan                                                                                                                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lisensi kode   | Proyek ini adalah fork dari kode berlisensi **MIT**, © LuxAlgo Global, LLC. Salinan `LICENSE` upstream wajib disertakan.                                                                                       |
| Atribusi       | Cantumkan di halaman About/footer: "Berdasarkan pada LuxAlgo trade-journal (MIT)." Tautan ke repositori upstream tetap tersedia.                                                                               |
| Nama & merek   | Nama aplikasi adalah **Trade Jurnal by Artian Capital Group**. **Jangan** memakai nama "LuxAlgo", logo LuxAlgo, atau merek dagang lainnya sebagai identitas aplikasi. Komponen logo upstream diganti.          |
| Nama paket npm | `@luxalgo/journal-core`, `@luxalgo/journal-importers`, `@luxalgo/broker-sdk`, `@luxalgo/vela` tetap dipakai sebagai dependensi teknis; ini bukan klaim merek di UI.                                            |
| Disclaimer     | Tetap sertakan: laporan & analitik mencerminkan data broker; hasil AI **bukan** nasihat investasi; tidak ada metrik yang menjamin hasil di masa depan. Periksa kembali angka penting dengan pernyataan broker. |
| Data pengguna  | Beritahu pengguna bahwa data tersimpan di server operator dan kredensial dienkripsi. Tidak ada layanan analitik/tracking pihak ketiga.                                                                         |

## Status dokumentasi

Dokumen ini ditulis sebelum implementasi. Bila ada keputusan berbeda dari asumsi di sini (misalnya pilih BYOK, model lain, atau hosting serverless), dokumen akan diperbarui menyesuaikan keputusan Anda sebelum kode ditulis.
