// QR code rendering — uses the tested encoder in ./qr.
// Code128-B helper remains below for other uses.
import { encodeQr } from "./qr";

/** Draw a crisp QR code fitted inside (x, y, size, size) with a 2-module quiet zone. */
export const drawQrCode = (
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  color = "#000000",
  bgColor = "rgba(255,255,255,0)",
): void => {
  const matrix = encodeQr(value);
  if (!matrix) return;
  const modules = matrix.length;
  const quiet = 2;
  const total = modules + quiet * 2;
  const mod = size / total;

  ctx.save();
  if (bgColor !== "rgba(255,255,255,0)") {
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, size, size);
  }
  ctx.fillStyle = color;
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      if (!matrix[r]![c]) continue;
      const rx = Math.floor(x + (c + quiet) * mod);
      const ry = Math.floor(y + (r + quiet) * mod);
      const rx2 = Math.ceil(x + (c + quiet + 1) * mod);
      const ry2 = Math.ceil(y + (r + quiet + 1) * mod);
      ctx.fillRect(rx, ry, rx2 - rx, ry2 - ry);
    }
  }
  ctx.restore();
};

export interface Barcode {
  /** One entry per bar/space; `true` means a black bar. */
  modules: boolean[];
  checksum: number;
}

/** Code128-B bar/space widths for codes 0–106. */
const PATTERNS = [
  "212222",
  "222122",
  "222221",
  "121223",
  "121322",
  "131222",
  "122213",
  "122312",
  "132212",
  "221213",
  "221312",
  "231212",
  "112232",
  "122132",
  "122231",
  "113222",
  "123122",
  "123221",
  "223211",
  "221132",
  "221231",
  "213212",
  "223112",
  "312131",
  "311222",
  "321122",
  "321221",
  "312212",
  "322112",
  "322211",
  "212123",
  "212321",
  "232121",
  "111323",
  "131123",
  "131321",
  "112313",
  "132113",
  "132311",
  "211313",
  "231113",
  "231311",
  "112133",
  "112331",
  "132131",
  "113123",
  "113321",
  "133121",
  "313121",
  "211331",
  "231131",
  "213113",
  "213311",
  "213131",
  "311123",
  "311321",
  "331121",
  "312113",
  "312311",
  "332111",
  "314111",
  "221411",
  "431111",
  "111224",
  "111422",
  "121124",
  "121421",
  "141122",
  "141221",
  "112214",
  "112412",
  "122114",
  "122411",
  "142112",
  "142211",
  "241211",
  "221114",
  "413111",
  "241211",
  "134111",
  "111242",
  "121142",
  "121241",
  "114212",
  "124112",
  "124211",
  "411212",
  "421112",
  "421211",
  "212141",
  "214121",
  "412121",
  "111143",
  "111341",
  "131141",
  "114113",
  "114311",
  "411113",
  "411311",
  "113141",
  "114131",
  "311141",
  "411131",
  "211412",
  "211214",
  "211232",
  "2331112",
];

export const encodeCode128B = (value: string): Barcode => {
  const text = value.replace(/[^\x20-\x7E]/g, "").slice(0, 120) || "TRADE JURNAL";
  const values: number[] = [104];
  for (const char of text) values.push(char.charCodeAt(0) - 32);
  const checksum =
    values.reduce((sum, current, index) => sum + current * (index === 0 ? 1 : index), 0) % 103;
  values.push(checksum, 106);

  const modules: boolean[] = [];
  for (const code of values) {
    const pattern = PATTERNS[code] ?? PATTERNS[0]!;
    pattern.split("").forEach((digit, index) => {
      const width = Number(digit);
      for (let i = 0; i < width; i++) modules.push(index % 2 === 0);
    });
  }
  return { modules, checksum };
};

/** Draw a Code128-B barcode with quiet zones and the URL label underneath. */
export const drawBarcode = (
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  color = "rgba(255,255,255,0.92)",
): void => {
  const { modules } = encodeCode128B(value);
  const quiet = 10;
  const total = modules.length + quiet * 2;
  const module = width / total;
  ctx.save();
  ctx.fillStyle = color;
  modules.forEach((black, index) => {
    if (!black) return;
    ctx.fillRect(x + (index + quiet) * module, y, Math.ceil(module), height);
  });
  ctx.font = `${Math.max(12, height * 0.16)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(value, x + width / 2, y + height + Math.max(16, height * 0.2));
  ctx.restore();
};
