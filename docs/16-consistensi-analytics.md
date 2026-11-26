# 16 — Konsistensi Daily Journal & Analytics

## Masalah sebelumnya

Terdapat dua sistem:

- **Jurnal baru** (CFD / Futures / Crypto / US Stock) → Supabase `cfd_trades`
- **Mesin analytics upstream** (Dashboard, Calendar, Daily journal, Reports, Daftar Trades) → SQLite lokal

Data demo lama (112 trade, 53 loss) masih ada di SQLite, sehingga Daily journal/Daftar Trades showing minus sementara jurnal baru tidak.

## Solusi

- Data demo lama **dihapus**.
- Setiap kali trade jurnal dibuat/diubah/dihapus, server otomatis **menulis ulang mirror** ke SQLite lokal lewat [`server/legacy-sync.ts`](../apps/web/src/server/legacy-sync.ts).
- Endpoint manual: `POST /api/cfd-journal/sync` — membangun ulang mirror dari Supabase.
- Tombol **Load demo data** di Dashboard dan account selector **dihapus** agar tidak menimbulkan data tak konsisten lagi.

Supabase tetap **source of truth**; SQLite hanya cache analytics turunan. Jadi pindah server tidak kehilangan data.

Contoh hasil sinkron `ekaryan`: 7 trade, 0 loss, total P&L $1.336 — sama persis dengan `cfd_trades` di Supabase.

## Catatan

Trade dengan status `running` muncul sebagai posisi open di analytics, bukan trade tertutup — sesuai perilaku sistem round-trip.
