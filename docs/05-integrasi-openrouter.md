# 05 — Integrasi OpenRouter (menggantikan AI upstream)

## Keputusan

Seluruh fitur AI memakai **OpenRouter** sebagai satu-satunya penyedia. Dukungan langsung Anthropic dan OpenAI dihapus dari UI dan jalur reflection. OpenRouter **kompatibel dengan API Chat Completions OpenAI**, sehingga dapat memakai adapter `@ai-sdk/openai-compatible` yang sudah ada di upstream (sebelumnya dipakai untuk mode "OpenAI-compatible") sebagai jembatan.

## Konfigurasi

| Nama                        | Nilai / default                | Keterangan                                                               |
| --------------------------- | ------------------------------ | ------------------------------------------------------------------------ |
| `OPENROUTER_API_KEY`        | **(wajib)**                    | Kunci dari akun OpenRouter; dibaca dari environment server               |
| `OPENROUTER_BASE_URL`       | `https://openrouter.ai/api/v1` | Dapat diubah untuk gateway/proxy                                         |
| `OPENROUTER_MODEL`          | `openai/gpt-4.1-mini` (contoh) | Model default untuk refleksi                                             |
| `OPENROUTER_IMPORT_MODEL`   | mengikuti model default        | Model untuk AI statement import; wajib mendukung PDF + structured output |
| `OPENROUTER_ALLOWED_MODELS` | opsional                       | Daftar model yang boleh dipilih pengguna (kontrol biaya)                 |

Contoh model yang umum tersedia di OpenRouter untuk refleksi: `openai/gpt-4.1-mini`, `google/gemini-2.5-flash`, `anthropic/claude-sonnet-4.5`. **Periksa daftar & harga aktual di dashboard OpenRouter sebelum menetapkan default.** Model untuk AI import harus mendukung input PDF dan `response_format: json_schema`.

Header yang dikirim bersama permintaan (disarankan OpenRouter):

- `Authorization: Bearer <OPENROUTER_API_KEY>`
- `HTTP-Referer: https://<domain-anda>`
- `X-Title: Trade Jurnal by Artian Capital Group`

## Katalog model & panel admin (sesuai keputusan)

- **Semua model OpenRouter** diambil dari `GET {OPENROUTER_BASE_URL}/models` dan disimpan di tabel global `models`. Header permintaan: `Authorization: Bearer <kunci>`, `HTTP-Referer`, `X-Title`.
- Model diklasifikasikan **Free** bila `pricing.prompt` dan `pricing.completion` keduanya `0`, selebihnya **Paid**.
- **Pengguna pertama yang registrasi otomatis menjadi admin** (atau username yang cocok dengan `ADMIN_USERNAME`). Halaman `/admin` menyediakan tabel model, tombol **Sinkron dari OpenRouter**, pengaturan model default, kuota, dan izin model Paid.
- Perubahan admin pada tier/PDF/aktif ditandai `source = "admin"` sehingga **tidak ditimpa** saat sinkron ulang bila OpenRouter mengubah status free/paid.
- Pengguna biasa memilih model dari katalog di Settings (ditandai `[Free]`/`[Paid]`). Model **Paid diblokir** bila memakai kunci global, kecuali admin mengizinkan atau pengguna memakai kunci sendiri (BYOK).
- **Kuota 10 permintaan AI per pengguna per hari** (dapat diubah admin), dicatat di `ai_usage` dan diperiksa sebelum panggilan ke OpenRouter, termasuk AI statement import.

Endpoint admin: `GET /api/admin/models` dan `POST /api/admin/models` dengan `action: "sync" | "save"`.

## Perubahan pada kode upstream

| File upstream                        | Perubahan                                                                                                                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/server/ai.ts`                   | Hapus cabang `anthropic`/`openai`/`compatible`. Pakai `createOpenAICompatible({ baseURL, apiKey, headers })` secara tunggal. `runAi()` tetap diekspor dengan tanda tangan yang sama agar 3 route AI tidak berubah. |
| `src/lib/ai-settings.ts`             | `AI_PROVIDERS` menyusut menjadi `["openrouter"]`. Hapus `AI_KEY_VARIABLES` lama.                                                                                                                                   |
| `src/server/settings.ts`             | Hapus `getAiKey(provider)` lintas provider; ganti `getOpenRouterKey()` (environment atau kunci BYOK terenkripsi). `getAiModel()` membaca `OPENROUTER_MODEL` / daftar yang diizinkan.                               |
| `src/components/ai-settings.tsx`     | UI hanya menampilkan: model, status koneksi, dan (opsional) kunci BYOK. Hapus pilihan Anthropic/OpenAI.                                                                                                            |
| `src/server/ai-import.ts`            | Ganti `createOpenAI`/`createAnthropic` dengan adapter OpenRouter yang sama; tetap pakai `Output.object({ schema })` dan batas ukuran/file yang ada.                                                                |
| `src/lib/ai-import.ts`               | `AiImportProvider` disederhanakan menjadi `openrouter`; teks bantuan diperbarui.                                                                                                                                   |
| `.env.example`, `docker-compose.yml` | Ganti `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` dengan `OPENROUTER_API_KEY` (+ variabel model).                                                                                                                         |

System prompt, prompt recap/critique/ask, dan `ai-scope.ts` **tidak diubah**, sehingga perilaku & batas konteks tetap sama seperti upstream.

## Fitur AI yang tetap aktif

1. **Ringkasan sesi harian** (`POST /api/ai/recap`) — dari trade yang benar-benar terjadi pada hari itu + catatan harian pengguna, menghasilkan bagian **Keep**/**Fix**.
2. **Kritik per trade** (`POST /api/ai/critique`) — menilai kualitas entry/exit, sizing, stop/R, tag & mistake.
3. **Ask your journal** (`POST /api/ai/ask`) — menjawab pertanyaan dari agregat milik pengguna saja (simbol, hari, jam, durasi, tag, mistake, playbook). Tidak menelepon penyedia bila tidak ada trade yang cocok.
4. **AI statement import** — menguraikan pernyataan yang tidak dikenali menjadi execution untuk ditinjau pengguna sebelum disimpan.

## Kontrol biaya & keandalan

- `maxOutputTokens` dipertahankan (recap/ask 1200, critique lebih kecil, import 16000).
- Daftar model yang diizinkan bersifat server-side; klien tidak bisa sembarangan memilih model mahal.
- Kuota harian per pengguna (jumlah permintaan AI) — lihat [`04`](04-autentikasi-dan-pengguna.md).
- Jawaban di-cache hanya untuk permintaan identik dalam jendela singkat bila memungkinkan (opsional).
- Retry terbatas; pesan error diterjemahkan ke bentuk aman (tidak membocorkan potongan kunci atau data request):
  - `401/403` → "Kunci OpenRouter tidak valid / tidak memiliki izin."
  - `402` → "Saldo OpenRouter habis."
  - `429` → "Terlalu banyak permintaan, coba lagi nanti."
  - `404` / model tidak tersedia → "Model tidak tersedia; pilih model lain."
- Semua permintaan berasal dari server; kunci tidak pernah dikirim ke browser.

## BYOK opsional

Jika opsi **(C) hybrid** dipilih: pengguna boleh memasukkan kunci OpenRouter sendiri di Settings. Kunci disimpan terenkripsi AES-256-GCM dan hanya dikirim ke `https://openrouter.ai/api/v1`. Kunci global dari environment tetap dipakai bila pengguna tidak mengisi kunci sendiri.
