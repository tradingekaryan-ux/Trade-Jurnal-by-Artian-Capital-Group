# 13 — Promo, Role & Discord

## Tombol Discord mengambang

Tombol Discord muncul di semua halaman (kanan bawah) memakai **logo Discord asli**. Owner bisa mengubah URL dan visibilitas tombol di **Admin → Konfigurasi situs** (`/api/admin/site`, disimpan di `global_settings`). Nilai bawaan diambil dari `NEXT_PUBLIC_DISCORD_URL`; jika kosong, tautan `https://discord.com/`. Perubahan berlaku untuk semua akun pada permintaan halaman berikutnya.

## Halaman Promo — `/promo`

Setiap akun yang login bisa memposting promo:

- **Judul** (2–160 karakter) dan **deskripsi** (maks. 4000 karakter)
- **Gambar opsional** (PNG/JPEG/WebP, maks. 8 MB — tipe dicek dari bytes, bukan nama file)
- **Promo code** + toggle aktif/nonaktif → tombol sekali klik menyalin code ke clipboard
- **URL** + toggle aktif/nonaktif → tautan langsung membuka situs tujuan (`target="_blank"`)

Promo disimpan di database global agar bisa dilihat semua akun; gambar ikut tersimpan di sana dan disajikan lewat `/api/promos/[id]/image`.

### Voting Working / Not Working

Setiap promo menampilkan testimoni komunitas: tombol **Working** dan **Not Working** dengan jumlah vote. Satu akun hanya punya **satu vote per promo**, dan bisa mengubah atau membatalkan pilihannya dengan mengklik tombol lain. Ringkasan vote diambil lewat `GET /api/promos/vote?ids=...`; pengiriman vote lewat `POST /api/promos/vote`. Pengguna belum login tidak bisa vote (tombol dinonaktifkan).

API: `GET/POST/PATCH/DELETE /api/promos`. `GET` hanya mengembalikan `kind = 'promo'`; trade idea tidak ikut muncul di halaman promo. Owner/admin bisa mengelola promo siapa pun; member hanya promo miliknya sendiri.

## Halaman Trades Idea — `/ideas`

Sama seperti promo, tetapi:

- postingan **wajib gambar** (judul + deskripsi + gambar);
- **tanpa** promo code dan URL;
- voting diubah menjadi **Stop Loss** vs **Take Profit** (`/api/ideas/vote`);
- kedua halaman menampilkan **batang persentase live** yang diperbarui seketika setelah vote. Warna: **Working hijau / Not Working merah**; **Take Profit hijau / Stop Loss merah**.

Feed gabungan: `GET /api/posts? ...` mengembalikan promo dan idea dengan field `kind`.

## Role & hak akses

| Role       | Hak                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| **Owner**  | Hak admin + **konfigurasi situs** (link/button Discord, judul situs), satu-satunya yang membuat user & role |
| **Admin**  | Akses halaman Admin, **seluruh jurnal & data member**, dan **hapus akun** (kecuali owner & diri sendiri)    |
| **Member** | Jurnal dan postingan sendiri (default untuk pendaftar baru)                                                 |

Role lama `staff`/`company` dinormalisasi menjadi `member` saat aplikasi berjalan. Halaman `/admin` hanya bisa diakses **Owner/Admin**. API `/api/admin/models`, `/api/admin/users` (GET/DELETE), `/api/admin/member-data`, dan `/api/admin/site` memeriksa role di server, bukan hanya menyembunyikan UI.

Owner ditandai **centang kuning**, admin **centang biru** — muncul di user menu, daftar akun, profil, dan postingan yang mereka upload (`authorRole` dari API). `GET /api/admin/member-data` menampilkan ringkasan semua member; `?userId=...` mengembalikan jurnal, postingan, dan snapshot Supabase lengkap untuk member tersebut.

### Akun owner khusus

Saat aplikasi pertama kali berjalan, dibuat akun owner otomatis:

- Username: `OWNER_USERNAME` (default `owner`)
- Password: `OWNER_PASSWORD` bila diisi. Jika tidak, password acak 16 karakter dibuat dan ditulis ke **`data/owner-credentials.txt`** (mode `0600`). Periksa file tersebut setelah deploy pertama dan simpan kredensial di tempat aman.
- Role owner tidak bisa diubah atau dibuat ulang lewat halaman admin.

## Catatan keamanan

- Password tetap di-hash dengan scrypt + salt per user.
- Tidak ada verifikasi email (sesuai desain awal aplikasi).
- Role dicek ulang di setiap endpoint; perubahan role langsung berlaku pada permintaan berikutnya.
