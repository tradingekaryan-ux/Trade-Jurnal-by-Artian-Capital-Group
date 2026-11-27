# 18 — Fitur AI (OpenRouter)

Semua fitur AI memakai satu gateway OpenRouter, kunci tidak pernah dikirim ke browser, dan bersama-sama memakai kuota **10 permintaan/hari** per akun. BYOK membuka model Paid tetapi tidak menambah kuota.

## Fitur aktif

| Fitur                   | Lokasi                                 | Endpoint                                         | Data                                                                                                                 |
| ----------------------- | -------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Tanya Jurnal            | `/reports`                             | `/api/ai/ask`                                    | Agregat legacy + `cfd_trades`, notebook, playbook, progress, Edge Score. Jawaban identik di-cache 5 menit.           |
| AI Recap                | `/journal/[date]`                      | `/api/ai/recap`                                  | Trade close pada tanggal itu + catatan harian.                                                                       |
| AI Review (jurnal baru) | `/journal/cfd`, futures, crypto, stock | `/api/cfd-journal/ai-review`                     | Detail trade + playbook + screenshot (Vision otomatis jika model mendukung `image`).                                 |
| AI Review (legacy)      | `/trades/[key]`                        | `/api/ai/critique`                               | Satu trade + execution + annotations.                                                                                |
| Debrief otomatis        | saat menutup trade di jurnal baru      | `/api/cfd-journal` PATCH                         | Aturan playbook + konteks jurnal; hasil ditulis ke `cfd_trades.notes` (best-effort).                                 |
| AI Performance Recap    | `/reports`                             | `/api/ai/performance`, `/api/ai/performance/pdf` | 7/30 hari terakhir + Edge Score + peringkat leaderboard; PDF diekspor.                                               |
| AI Import               | `/import`                              | `/api/import`                                    | PDF/teks → execution terstruktur; preview dibekukan & wajib direview. Pengecekan tier Paid disamakan dengan `runAi`. |
| Asisten komunitas       | `/ideas`, `/promo`                     | `/api/ai/community`                              | Konsensus SL/TP idea + penandaan promo berisiko.                                                                     |

Sisa kuota ditampilkan di user menu (sidebar) lewat `GET /api/ai/quota`.

## Deteksi kapabilitas model

`capabilitiesFor()` di `lib/model-capabilities.ts` membaca `architecture.input_modalities` dari OpenRouter: `image`/`video` → Vision, `file` → File/PDF. Owner bisa mengoverride lewat checkbox di Admin → Katalog model. Saat ada screenshot, `pickVisionModel()` otomatis memakai model Vision pertama yang aktif bila model pilihan pengguna tidak mendukung gambar.
