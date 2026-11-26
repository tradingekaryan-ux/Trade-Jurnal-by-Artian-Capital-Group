# 15 — Penghapusan data & Profil user

## Aturan penghapusan

| Aksi                                         | Efek                                                                                                                                                                                                                    |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hapus **satu trade** (jurnal)                | Trade itu terhapus dari `cfd_trades` beserta `image_attachments`-nya                                                                                                                                                    |
| Hapus **jurnal** (tombol "Hapus jurnal ini") | **Semua trade** dengan mode jurnal itu ikut terhapus, berikut referensi gambarnya di `image_attachments`                                                                                                                |
| Hapus **promo / trade idea**                 | **Semua voting** (`promo_votes`) untuk postingan itu ikut terhapus, lalu postingannya                                                                                                                                   |
| Hapus **akun** (Admin → User & Role)         | Semua data akun: trade, gambar, postingan, voting yang diterima **dan** yang diberikan, notebook/playbook (snapshot), profil, sesi, kuota AI, riwayat login yang gagal, snapshot Supabase, **dan file SQLite lokalnya** |

Semua penghapusan berantai ada di satu modul, [`server/cascade.ts`](../apps/web/src/server/cascade.ts), dan dijalankan **eksplisit** di server dalam satu transaksi — tidak hanya bergantung pada `ON DELETE CASCADE`. Setiap endpoint mengembalikan jumlah baris yang terhapus, lalu UI menampilkannya di pesan konfirmasi.

Verifikasi otomatis: jalankan `node scripts/verify-cascade.mjs` saat preview aktif. Skrip membuat akun uji beserta trade, gambar, postingan, vote, profil, catatan, dan file SQLite lokal — lalu memastikan semuanya hilang setelah jurnal, postingan, dan akun dihapus. Akun uji selalu dibersihkan di blok `finally`.

## Profil user — `/profile`

- **Nama tampilan** dan **bio** (maks. 2000 karakter)
- **Foto profil** dan **banner** (PNG/JPEG/WebP, maks. 16 MB per gambar)
- Gambar diunggah ke **imgdb.io**; Supabase hanya menyimpan URL-nya di tabel `profiles`
- Profil bisa dilihat publik lewat `GET /api/profile?userId=<id>`; edit hanya pemiliknya
- Tampilan profil: banner, foto, nama, username, role, dan bio

## Catatan hosting

Data yang **bersifat penting dan harus selamat** jika server gratis dihentikan — user, session, jurnal, promo, voting, profil, katalog model, kuota — semuanya ada di **Supabase Postgres**, bukan di kontainer Northflank.

Yang masih dijalankan di server Northflank hanyalah **proses komputasi tanpa state penting**:

- autentikasi & session lookup (koneksi ke Supabase)
- upload gambar ke imgdb.io
- kalkulasi jurnal, simulasi prop-firm, dan pengolahan AI
- cache sementara (mis. daftar prop firm, transport)

Jadi jika Anda pindah dari Northflank ke server lain, **tidak ada data yang perlu dipindahkan** — cukup jalankan ulang kontainer dengan env `DATABASE_URL` yang sama.

Skema `profiles` dibuat otomatis oleh `scripts/setup-supabase.mjs`.
