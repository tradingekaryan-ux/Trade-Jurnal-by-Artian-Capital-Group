export const AI_IMPORT_MAX_BYTES = 8 * 1024 * 1024;
export const AI_IMPORT_MAX_TEXT = 150_000;
export const AI_IMPORT_MAX_EXECUTIONS = 200;
export const AI_IMPORT_HELP =
  "Jika format file tidak dikenali, AI parsing dapat membantu. OpenRouter akan menguraikan pernyataan broker menjadi execution untuk Anda tinjau sebelum disimpan. Periksa kembali jumlah, harga, fee, dan tanggal terhadap pernyataan asli. File dikirim dari server ke OpenRouter; biaya pemakaian berlaku dan kuota harian aplikasi terpakai.";

export interface AiImportOptions {
  model: string;
  apiKey?: string;
}

export const isAiImportOptions = (value: unknown): value is AiImportOptions =>
  Boolean(value && typeof value === "object");
