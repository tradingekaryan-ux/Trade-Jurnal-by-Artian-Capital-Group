# 15 — Penghapusan data & Profil user

## Aturan penghapusan

| Aksi                                         | Efek                                                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Hapus **satu trade** (jurnal)                | Trade itu terhapus dari `cfd_trades`                                                                     |
| Hapus **jurnal** (tombol "Hapus jurnal ini") | **Semua trade** dengan mode jurnal itu ikut terhapus, berikut referensi gambarnya di `image_attachments` |
| Hapus **promo / trade idea**                 | **Semua voting** (`promo_votes`) untuk postingan itu ikut terhapus, lalu postingannya                    |
| Hapus akun (SQL/Supabase)                    | Session, profil, jurnal, promo, dan voting ikut terhapus lewat foreign key `ON DELETE CASCADE`           |

Penghapusan voting dan jurnal dilakukan **eksplisit** di server, bukan hanya mengandalkan cascade — jadi urutannya jelas dan bisa diverifikasi.

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
