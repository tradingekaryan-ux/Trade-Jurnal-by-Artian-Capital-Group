# 04 — Autentikasi & multi-pengguna

## Keputusan desain

Sesuai permintaan: **login dan registrasi hanya memakai username + password, tanpa verifikasi apa pun**. Tidak ada email, OTP, tautan aktivasi, atau konfirmasi. Akun langsung dapat digunakan setelah registrasi.

Karena tidak ada verifikasi, perlindungan dasar diletakkan pada **kekuatan kata sandi**, **rate limiting**, dan **isolasi data**.

## Registrasi

| Aspek       | Spesifikasi                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| Field       | `username`, `password` (tanpa email)                                                                                |
| Username    | 3–32 karakter, huruf/angka/underscore/dash, huruf kecil dinormalisasi, unik (case-insensitive)                      |
| Password    | Minimal 8 karakter; disarankan 12+; ditolak bila masuk daftar kata sandi umum                                       |
| Penyimpanan | `scrypt` dengan salt acak 16 byte per pengguna (node:crypto), parameter standar; **tidak** menyimpan password plain |
| Terakhir    | Tidak ada email verifikasi, langsung dibuat session & diarahkan ke dashboard                                        |
| Rate limit  | 3 registrasi per IP per jam (dapat disesuaikan)                                                                     |

Contoh alur: `POST /api/register` → validasi → cek username unik → hash → INSERT user → buat session → set cookie → `201 { ok: true }`.

## Login

| Aspek         | Spesifikasi                                                                           |
| ------------- | ------------------------------------------------------------------------------------- |
| Field         | `username`, `password`                                                                |
| Verifikasi    | Bandingkan hash dengan `timingSafeEqual` setelah scrypt                               |
| Rate limit    | 5 percobaan gagal per IP + per username dalam 15 menit; jeda progresif                |
| Respons gagal | Pesan generik "Username atau password salah" (tidak memberitahu akun mana yang salah) |
| Audit         | Simpan waktu & IP percobaan gagal (tanpa password) untuk diagnosis                    |
| Session       | Dibuat ulang ID saat login (session rotation)                                         |

## Session

- Cookie: `tj_session`, `httpOnly`, `SameSite=Lax`, `Secure` saat HTTPS, `path=/`, masa berlaku **30 hari** (bisa diatur).
- Nilai cookie adalah **ID acak 32 byte** yang disimpan di tabel `sessions` bersama `user_id`, `expires_at`, `created_at`.
- Cookie ditandatangani HMAC dengan `AUTH_SECRET` untuk mencegah pemalsuan; server memverifikasi tanda tangan **dan** mencocokkan record session di DB.
- Logout menghapus record session dan cookie.
- Ganti password (fitur opsional lanjutan) mencabut semua session pengguna tersebut.

## Isolasi data (wajib)

Aturan yang harus dipatuhi implementasi:

1. Setiap pengguna memiliki file database sendiri (`data/users/<id>.db`); tabel global (`users`, `sessions`, `ai_usage`, `models`) ada di `data/journal.db`.
2. Route handler **tidak pernah** menerima `userId` dari body atau query klien. Nilai diambil dari session yang terverifikasi.
3. Wrapper `handler()` memanggil `runAsUser(userId, ...)`; proxy `db` mengarahkan seluruh query ke file pengguna tersebut.
4. Endpoint yang menerima ID resource (mis. `key` trade, `id` note) secara alami hanya melihat data di database pengguna yang login; resource milik akun lain tidak pernah ada di sana.
5. Kredensial broker dan kunci OpenRouter BYOK dienkripsi AES-256-GCM dengan kunci dari `JOURNAL_SECRET`; hanya terdekripsi di server.
6. Kuota AI 10 permintaan/hari dicatat di tabel global `ai_usage` per `(user_id, day)` dan diperiksa sebelum setiap panggilan AI.

## Anti-penyalahgunaan (karena gratis & tanpa verifikasi)

| Mekanisme                             | Tujuan                                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Rate limit login/registrasi           | Mencegah brute-force & spam akun                                                                           |
| Kuota AI per pengguna/hari            | Mengendalikan biaya OpenRouter                                                                             |
| Batas akun & ukuran file per pengguna | Mencegah penyalahgunaan storage                                                                            |
| Validasi ukuran & tipe lampiran       | Mencegah upload berbahaya                                                                                  |
| `Cache-Control: private, no-store`    | Mencegah data tersimpan di cache bersama                                                                   |
| Opsi CAPTCHA (opsional)               | Hanya bila spam masih terjadi; memerlukan kunci layanan tambahan (lihat [`06`](06-api-yang-dibutuhkan.md)) |

## Perilaku yang tidak diubah

- Mode privasi (masking nilai uang) tetap berfungsi per pengguna.
- Data demo tetap dibuat sebagai akun terpisah di bawah pengguna yang memuatnya.
- Tidak ada notifikasi/email keluar dari aplikasi.
