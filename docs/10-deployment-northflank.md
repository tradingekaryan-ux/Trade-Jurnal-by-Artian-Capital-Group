# 10 — Deployment di Northflank (pilihan yang dipakai)

Aplikasi **tidak perlu diubah** untuk Northflank: sudah menggunakan Dockerfile, satu port (`3000`), dan direktori data `/data` yang bisa di-mount ke persistent volume.

## Ringkasan

| Item       | Nilai                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------ |
| Build      | Dockerfile di root repository, build context `/`, engine **BuildKit**                      |
| Service    | **Combined service** (build + deploy dari GitHub) atau **Deployment service** dari image   |
| Repository | `https://github.com/tradingekaryan-ux/Trade-Jurnal-by-Artian-Capital-Group`, branch `main` |
| Port       | `3000` public, protokol HTTP                                                               |
| Volume     | Persistent volume, `containerMountPath: /data`, mode `ReadWriteOnce`                       |
| Instance   | **1** (volume RWO tidak bisa dipakai banyak replica)                                       |

## Langkah di dashboard

1. Daftar/masuk Northflank → buat **Project** (pilih Northflank Cloud).
2. **Create service → Combined**. Isi:
   - Nama: `trade-jurnal`
   - Repository: hubungkan GitHub, pilih repository tersebut dan branch `main`
   - Build options: **Dockerfile**, path `/Dockerfile`, build context `/`
   - Advanced build settings → build engine **BuildKit**
3. Networking: Northflank biasanya mendeteksi `EXPOSE 3000`. Pastikan port **3000** berstatus public HTTP. Tambahkan domain gratis `*.code.run` atau domain sendiri + TLS.
4. **Environment variables** (runtime, bukan build arg):

   | Key                   | Wajib      | Catatan                                                     |
   | --------------------- | ---------- | ----------------------------------------------------------- |
   | `OPENROUTER_API_KEYS` | ✅         | Beberapa kunci dipisah koma; jangan pernah commit ke GitHub |
   | `AUTH_SECRET`         | ✅         | Rahasia penandatanganan session; beda tiap deployment       |
   | `SITE_URL`            | disarankan | URL publik, dikirim sebagai `HTTP-Referer` ke OpenRouter    |
   | `JOURNAL_DATA_DIR`    | ✅         | Isi `/data`                                                 |
   | `JOURNAL_SECRET`      | opsional   | Kunci enkripsi kredensial; simpan terpisah dari backup      |
   | `ADMIN_USERNAME`      | opsional   | Username yang otomatis jadi admin saat registrasi           |

   Gunakan **secret group** agar nilai tidak tampil di UI biasa. Pengguna pertama yang registrasi tetap otomatis menjadi admin.

5. **Advanced → Add volume**:
   - Nama: `trade-jurnal-data`
   - `containerMountPath`: `/data`
   - Access mode: **ReadWriteOnce** (disarankan untuk database)
   - Ukuran: misalnya **1 GB** — volume **tidak bisa dikecilkan** setelah dibuat, hanya diperbesar.
   - Pastikan service hanya **1 instance**.
6. Create service. Northflank akan build dan deploy otomatis. Setelah hidup:
   - Buka domain, registrasi akun pertama (menjadi admin).
   - Buka `/admin` → **Sinkron dari OpenRouter** untuk mengisi katalog model Free/Paid.
   - Aktifkan **Hyperliquid TradFi** di `Settings → Market data` bila ingin replay/MAE-MFE.

## Izin volume

Northflank memberikan kepemilikan volume kepada group yang ditentukan image Docker. Dockerfile proyek ini sudah:

```
RUN mkdir -p /data && chown -R node:node /data /app
USER node
```

Jadi user `node` (gid 1000) dapat menulis ke `/data`. Jika tetap muncul `EACCES`, minta Northflank menjalankan custom command sebagai root untuk `chown -R node:node /data`, lalu restart service.

## Backup & restore

- Gunakan **backup volume** Northflank, atau salin isi `/data` lewat service/CLI.
- Isi `/data` mencakup `journal.db` (users, session, kuota, katalog model) dan `users/<id>.db` (jurnal tiap pengguna + lampiran).
- Simpan nilai `AUTH_SECRET` dan `JOURNAL_SECRET` **terpisah** dari backup. Tanpa `JOURNAL_SECRET`, kredensial terenkripsi tidak bisa dibaca setelah restore.
- Jangan menghapus volume saat service dihapus bila data masih dibutuhkan — volume ditagih selama masih ada, termasuk saat service mati.

## Batas & catatan Sandbox (Free)

- Plan **Sandbox**: 2 service, 2 job, 1 database, hingga **$20/bulan** resource, **always on**, tanpa kartu menurut halaman pricing (dokumen billing lain menyebut kartu untuk verifikasi — cek saat daftar).
- Volume dikenakan biaya dari kuota resource tersebut dan tetap ditagih walau service di-scale ke nol.
- Sandbox ditujukan untuk hobby/eksperimen, bukan produksi. Pasang **billing alert** agar tidak terkejut bila ada pemakaian di luar kuota.
- Egress dikenakan biaya terpisah ($0,06/GB pada plan berbayar); pantau bila traffic besar.
- Karena memakai volume RWO, **jangan scale ke banyak replica** dan harapkan sedikit downtime saat redeploy.

## CLI (opsional)

Install: `npm i -g @northflank/cli` lalu `nf login`. File [`northflank.example.yaml`](../northflank.example.yaml) bisa disalin menjadi `northflank.yaml` dan diisi ID resource agar perintah CLI tidak perlu menyebut `--project`/`--service` setiap kali. Jangan commit ID/secret sensitif bila repository bersifat publik — gunakan placeholder.

Referensi: [Build and deploy](https://northflank.com/docs/v1/application/getting-started/build-and-deploy-your-code) · [Add a persistent volume](https://northflank.com/docs/v1/application/databases-and-persistence/add-a-volume) · [Pricing](https://northflank.com/pricing)
