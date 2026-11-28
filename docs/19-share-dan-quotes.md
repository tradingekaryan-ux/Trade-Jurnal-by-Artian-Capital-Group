# 19 — Quote slideshow & PNG Share

## Quote dashboard

Di bagian atas `/dashboard` ada slideshow quote yang berganti setiap **3 detik**. Quote bawaan mencakup:

> Always trade base on ur rule, not with ur own feelings

Owner bisa mengganti seluruh daftar di **Admin → Konfigurasi situs → Quote dashboard** (satu quote per baris, maks. 50). Data disimpan di `global_settings.dashboardQuotes`; endpoint baca `GET /api/quotes` (public) dan tulis `POST /api/admin/quotes` (owner only).

## PNG Share (offline, browser)

Halaman **/share** menyediakan tiga alat ekspor PNG:

1. **PnL per Periode** — `Per Trade`, `Per Day`, `Per Week`, `Per Month`, `Per Year`, `All Time`.
2. **Jurnal PnL** — ringkasan seluruh jurnal + peringkat leaderboard.
3. **Postingan** — promo/discount atau trade idea milik sendiri.

Sumber data: `GET /api/share/data` (hanya akun sendiri). Render memakai `<canvas>` di browser (`lib/share-image.ts`) — **tidak ada gambar/video yang diunggah**.

- Ukuran: **1920×1080** atau **1080×1080**.
- Background: gambar apa pun, atau video **maksimal 15 detik**; user bisa memilih frame lewat slider.
- Kontrol background: tombol **atas / kiri / kanan / bawah**, **zoom in / zoom out**, dan **reset posisi** (`components/background-controls.tsx`). Drag di preview juga tetap didukung.
- Saat background diimpor, overlay otomatis diset **65%** dan preview di-render ulang (`bgVersion`) agar gambar langsung tampil tanpa harus menggeser slider opacity.
- Gradient gelap hanya menutup **72% sisi kiri** ketika background custom dipakai, sehingga gambar tidak tertutup seluruhnya. Tombol "Gunakan Chart Default" mengembalikan overlay ke 85%.
- Footer wajib pada semua PNG share (jurnal PnL, trade PnL, sertifikat):
  - kiri bawah: tanda tangan **Eka Ryan** (font `public/fonts/Allura-Regular.ttf`, OFL) + nama cetak **Pt. Eka Ryan M.**
  - kanan bawah: barcode Code128 (`lib/barcode.ts`) yang meng encodes alamat website + label URL.

## Perbaikan tanggal

`GET /api/cfd-journal` kini memetakan kolom snake_case (`opened_at`, `closed_at`, `take_profit`, dll.) ke camelCase. Tabel riwayat trade di `/journal/cfd`, futures, crypto, dan stock tidak lagi menampilkan **Invalid Date**.
