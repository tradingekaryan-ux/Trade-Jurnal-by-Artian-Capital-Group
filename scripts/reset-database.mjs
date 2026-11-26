import { rmSync } from "node:fs";
import { join } from "node:path";

/**
 * Hapus SEMUA data aplikasi (database global, database per-user, demos, lampiran,
 * promo, vote, dll.) dan biarkan aplikasi membuat ulang semuanya saat start.
 *
 * Jalankan dengan: node scripts/reset-database.mjs [--yes]
 */
const root = process.cwd();
const targets = [join(root, "data"), join(root, "apps", "web", "data")];
const confirmed = process.argv.includes("--yes") || process.env.ASSUME_YES === "1";
if (!confirmed) {
  console.error("Tambahkan --yes untuk mengonfirmasi penghapusan seluruh data.");
  process.exit(1);
}
for (const target of targets) {
  rmSync(target, { recursive: true, force: true });
  console.log("Dihapus:", target);
}
console.log("Selesai. Jalankan aplikasi untuk membuat database kosong + akun owner baru.");
