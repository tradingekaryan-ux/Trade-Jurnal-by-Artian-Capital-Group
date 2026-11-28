# 22 — Tema analitik ungu (referensi UI)

Gaya visual mengikuti referensi dashboard analitik: panel kaca gelap dengan tepi gradien ungu–magenta–teal, breadcrumb/navigation berbentuk pill, kartu metrik dengan aksen gradien, donut/radial berwarna, dan tabel dengan status dot.

## Prinsip penerapan

- **Token dulu, komponen kemudian.** Warna didefinisikan di `globals.css` (`--background`, `--card`, `--brand`, `--profit`, `--loss`, `--series-1..8`). Semua halaman dan chart (ECharts/Recharts lewat `components/charts/tokens.ts`) otomatis mengikuti.
- **Struktur komponen tidak diubah.** Perubahan hanya berupa nilai token, class styling pada `Card`, `Tabs`, dan aturan CSS global. Tidak ada handler, state, endpoint, atau skema yang disentuh.
- **Warna bukan satu-satunya penanda.** Profit/loss tetap memakai teks bertanda `+`/`−`, status memakai teks, dan bentuk marker berbeda.

## Palet dark

| Token                | Nilai                                                  | Peran                                          |
| -------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| `--background`       | `#08070d`                                              | Kanvas dengan ambient radial ungu/magenta/teal |
| `--card`             | `#100e18`                                              | Permukaan panel                                |
| `--border`           | `#282139`                                              | Hairline                                       |
| `--brand` / `--ring` | `#a855f7`                                              | Fokus, link, aksi utama                        |
| `--profit`           | `#34d399`                                              | Profit / buy / status baik                     |
| `--loss`             | `#fb7185`                                              | Loss / sell / status buruk                     |
| `--series-1..8`      | ungu, magenta, teal, amber, biru, cyan, lavender, pink | Urutan seri grafik                             |

## Perlakuan global

- Panel memakai **gradient border** 1px (`padding-box` + `border-box`) dan glow ungu halus.
- Navigasi sidebar aktif memakai pill gradien ungu → fuchsia.
- Tombol primer dan tab aktif memakai gradien `violet → fuchsia`.
- Popover/menu memakai latar `#171329 → #100e18` dengan border ungu.
- Input/textarea fokus memakai ring ungu 3px; scrollbar tipis ungu.
- Baris tabel saat hover mendapat tint ungu 5%.

Semua aturan ada di blok `Violet analytics shell` pada `apps/web/src/app/globals.css`.
