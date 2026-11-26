# 13 — Promo, Role & Discord

## Tombol Discord mengambang

Tombol Discord muncul di semua halaman (kanan bawah). URL diambil dari `NEXT_PUBLIC_DISCORD_URL`. Jika belum diisi, tautan mengarah ke `https://discord.com/` — **ganti dengan invite server Anda** di environment produksi.

## Halaman Promo — `/promo`

Setiap akun yang login bisa memposting promo:

- **Judul** (2–160 karakter) dan **deskripsi** (maks. 4000 karakter)
- **Gambar opsional** (PNG/JPEG/WebP, maks. 8 MB — tipe dicek dari bytes, bukan nama file)
- **Promo code** + toggle aktif/nonaktif → tombol sekali klik menyalin code ke clipboard
- **URL** + toggle aktif/nonaktif → tautan langsung membuka situs tujuan (`target="_blank"`)

Promo disimpan di database global agar bisa dilihat semua akun; gambar ikut tersimpan di sana dan disajikan lewat `/api/promos/[id]/image`.

### Voting Working / Not Working

Setiap promo menampilkan testimoni komunitas: tombol **Working** dan **Not Working** dengan jumlah vote. Satu akun hanya punya **satu vote per promo**, dan bisa mengubah atau membatalkan pilihannya dengan mengklik tombol lain. Ringkasan vote diambil lewat `GET /api/promos/vote?ids=...`; pengiriman vote lewat `POST /api/promos/vote`. Pengguna belum login tidak bisa vote (tombol dinonaktifkan).

API: `GET/POST/PATCH/DELETE /api/promos`. Moderator bisa mengubah status promo siapa pun; akun company hanya promo miliknya sendiri.

## Halaman Trades Idea — `/ideas`

Sama seperti promo, tetapi:

- postingan **wajib gambar** (judul + deskripsi + gambar);
- **tanpa** promo code dan URL;
- voting diubah menjadi **Stop Loss** vs **Take Profit** (`/api/ideas/vote`);
- kedua halaman menampilkan **batang persentase live** yang diperbarui seketika setelah vote. Warna: **Working hijau / Not Working merah**; **Take Profit hijau / Stop Loss merah**.

Feed gabungan: `GET /api/posts? ...` mengembalikan promo dan idea dengan field `kind`.

## Role & hak akses

| Role        | Hak                                                                 |
| ----------- | ------------------------------------------------------------------- |
| **Owner**   | Semua akses, satu-satunya yang bisa **membuat user & memberi role** |
| **Admin**   | Akses halaman Admin (katalog model) + moderasi semua promo          |
| **Staff**   | Moderasi semua promo (tanpa akses halaman Admin)                    |
| **Company** | Membuat promo dan mengelola promo miliknya sendiri                  |
| **Member**  | Membuat promo miliknya sendiri (default untuk pendaftar baru)       |

Halaman `/admin` hanya bisa diakses **Owner/Admin**. API `/api/admin/models` dan `/api/admin/users` memeriksa role di server, bukan hanya menyembunyikan UI.

### Akun owner khusus

Saat aplikasi pertama kali berjalan, dibuat akun owner otomatis:

- Username: `OWNER_USERNAME` (default `owner`)
- Password: `OWNER_PASSWORD` bila diisi. Jika tidak, password acak 16 karakter dibuat dan ditulis ke **`data/owner-credentials.txt`** (mode `0600`). Periksa file tersebut setelah deploy pertama dan simpan kredensial di tempat aman.
- Role owner tidak bisa diubah atau dibuat ulang lewat halaman admin.

## Catatan keamanan

- Password tetap di-hash dengan scrypt + salt per user.
- Tidak ada verifikasi email (sesuai desain awal aplikasi).
- Role dicek ulang di setiap endpoint; perubahan role langsung berlaku pada permintaan berikutnya.
