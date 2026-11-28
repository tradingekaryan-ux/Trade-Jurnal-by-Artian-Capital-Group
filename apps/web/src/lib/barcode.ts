// ---------------------------------------------------------------------------
// Minimal QR-code renderer (Mode: Byte, ECC: M, Version auto 1-10)
// Pure canvas — no external dependencies.
// ---------------------------------------------------------------------------

/** QR Reed-Solomon GF(256) arithmetic */
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
((): void => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x = x < 128 ? x << 1 : (x << 1) ^ 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255]!;
})();
const gfMul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a]! + GF_LOG[b]!]!);
const gfPoly = (degree: number): number[] => {
  let p = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(p.length + 1).fill(0);
    for (let j = 0; j < p.length; j++) {
      next[j] = next[j]! ^ gfMul(p[j]!, GF_EXP[i]!);
      next[j + 1] = next[j + 1]! ^ p[j]!;
    }
    p = next;
  }
  return p;
};
const rsBlock = (data: number[], eccCount: number): number[] => {
  const gen = gfPoly(eccCount);
  const msg = [...data, ...new Array<number>(eccCount).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i]!;
    if (coef !== 0) for (let j = 0; j < gen.length; j++) msg[i + j]! ^= gfMul(gen[j]!, coef);
  }
  return msg.slice(data.length);
};

// Version capacity table (byte mode, ECC level M): [totalDcw, ecwPerBlock, totalBlocks]
const QR_CAP: [number, number, number][] = [
  [16, 10, 1], // v1: max 14 bytes
  [28, 16, 1], // v2: max 26 bytes
  [44, 26, 1], // v3: max 42 bytes
  [64, 18, 2], // v4: max 62 bytes
  [86, 24, 2], // v5: max 84 bytes
  [108, 16, 4], // v6: max 106 bytes
  [124, 18, 4], // v7: max 122 bytes
  [154, 22, 4], // v8: max 152 bytes
  [182, 22, 5], // v9: max 180 bytes
  [216, 26, 5], // v10: max 213 bytes
];

type Matrix = boolean[][];

const qrMatrix = (ver: number): Matrix => {
  const size = ver * 4 + 17;
  return Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
};

const setModule = (m: Matrix, r: number, c: number, v: boolean): void => {
  if (r >= 0 && r < m.length && c >= 0 && c < m[0]!.length) m[r]![c] = v;
};

const addFinder = (m: Matrix, reserved: Matrix, row: number, col: number): void => {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || rr >= m.length || cc < 0 || cc >= m.length) continue;
      const v =
        r >= 0 &&
        r <= 6 &&
        c >= 0 &&
        c <= 6 &&
        (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      m[rr]![cc] = v;
      reserved[rr]![cc] = true;
    }
  }
};

const addAlignment = (m: Matrix, reserved: Matrix, centers: number[]): void => {
  for (const r of centers) {
    for (const c of centers) {
      if (
        (r === 6 && c === 6) ||
        (r === 6 && c === centers.at(-1)) ||
        (r === centers.at(-1) && c === 6)
      ) {
        continue;
      }
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          m[r + dr]![c + dc] = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
          reserved[r + dr]![c + dc] = true;
        }
      }
    }
  }
};

const ALIGN_POS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

// Format info (ECC M = 00, mask 0..7), pre-BCH + XOR 0b101010000010010
const FORMAT_MASK: Record<number, number> = {
  0: 0b101010000010010,
  1: 0b101000100100101,
  2: 0b101111001111100,
  3: 0b101101101001011,
  4: 0b100010111111001,
  5: 0b100000011001110,
  6: 0b100111110010111,
  7: 0b100101010100000,
};

const writeFormat = (m: Matrix, maskPattern: number, size: number): void => {
  const fmt = FORMAT_MASK[maskPattern] ?? 0;
  const bits = fmt.toString(2).padStart(15, "0");
  const b = (i: number) => bits[i] === "1";

  const hCols = [
    0,
    1,
    2,
    3,
    4,
    5,
    7,
    8,
    size - 7,
    size - 6,
    size - 5,
    size - 4,
    size - 3,
    size - 2,
    size - 1,
  ];
  const vRows = [
    size - 1,
    size - 2,
    size - 3,
    size - 4,
    size - 5,
    size - 6,
    size - 7,
    8,
    7,
    5,
    4,
    3,
    2,
    1,
    0,
  ];

  for (let i = 0; i < 15; i++) {
    setModule(m, 8, hCols[i]!, b(i));
    setModule(m, vRows[i]!, 8, b(i));
  }
  setModule(m, size - 8, 8, true); // dark module
};

const MASK_FN: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/** Encode a URL as a QR code matrix (version 1-10, ECC M, mask 0). */
const encodeQr = (text: string): Matrix | null => {
  const bytes = new TextEncoder().encode(text.slice(0, 200));
  const len = bytes.length;
  // Byte mode header: 4 bits mode + 8 bits (v1-9) or 16 bits (v10) count
  const capIdx = QR_CAP.findIndex(([totalDcw], idx) => {
    const countBits = idx + 1 >= 10 ? 16 : 8;
    return totalDcw * 8 >= 4 + countBits + len * 8;
  });
  if (capIdx < 0) return null;
  const [totalDcw, ecw, totalBlocks] = QR_CAP[capIdx]!;
  const ver = capIdx + 1;
  const size = ver * 4 + 17;

  // Build bit stream
  const bits: number[] = [];
  const push = (val: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };
  push(0b0100, 4); // byte mode
  push(len, ver >= 10 ? 16 : 8);
  bytes.forEach((b) => push(b, 8));
  push(0, Math.min(4, totalDcw * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const pads = [0xec, 0x11];
  for (let i = 0; bits.length < totalDcw * 8; i++) push(pads[i % 2]!, 8);

  const byteArr: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | (bits[i + j] ?? 0);
    byteArr.push(v);
  }

  // Split into RS blocks (group 1 has shorter blocks if remainder > 0)
  const dcwPerBlock = Math.floor(totalDcw / totalBlocks);
  const longBlocks = totalDcw % totalBlocks;
  const shortBlocks = totalBlocks - longBlocks;
  const dcBlocks: number[][] = [];
  let bytePos = 0;
  for (let b = 0; b < totalBlocks; b++) {
    const blen = dcwPerBlock + (b >= shortBlocks ? 1 : 0);
    dcBlocks.push(byteArr.slice(bytePos, bytePos + blen));
    bytePos += blen;
  }

  const ecBlocks = dcBlocks.map((block) => rsBlock(block, ecw));

  // Interleave data then EC codewords
  const maxDc = Math.max(...dcBlocks.map((b) => b.length));
  const finalBytes: number[] = [];
  for (let i = 0; i < maxDc; i++)
    dcBlocks.forEach((b) => {
      if (i < b.length) finalBytes.push(b[i]!);
    });
  for (let i = 0; i < ecw; i++)
    ecBlocks.forEach((b) => {
      if (i < b.length) finalBytes.push(b[i]!);
    });

  const finalBits: number[] = [];
  finalBytes.forEach((byte) => {
    for (let i = 7; i >= 0; i--) finalBits.push((byte >> i) & 1);
  });

  // Build matrix
  const m: Matrix = qrMatrix(ver);
  const reserved: Matrix = qrMatrix(ver);

  // Finders + 1-module separators
  addFinder(m, reserved, 0, 0);
  addFinder(m, reserved, 0, size - 7);
  addFinder(m, reserved, size - 7, 0);

  // Timing
  for (let i = 6; i < size - 6; i++) {
    m[6]![i] = i % 2 === 0;
    m[i]![6] = i % 2 === 0;
    reserved[6]![i] = true;
    reserved[i]![6] = true;
  }

  // Alignment
  const ap = ALIGN_POS[ver] ?? [];
  if (ap.length) addAlignment(m, reserved, ap);

  // Format area + dark module
  for (let i = 0; i <= 8; i++) {
    reserved[8]![i] = true;
    reserved[i]![8] = true;
    reserved[8]![size - 1 - i] = true;
    reserved[size - 1 - i]![8] = true;
  }
  reserved[size - 8]![8] = true;
  m[size - 8]![8] = true;

  // Place data bits
  let bitIdx = 0;
  const maskFn = MASK_FN[0]!;
  let goingUp = true;
  for (let col = size - 1; col >= 0; col -= 2) {
    if (col === 6) col--;
    for (let row = 0; row < size; row++) {
      const r = goingUp ? size - 1 - row : row;
      for (let dc = 0; dc < 2; dc++) {
        const c = col - dc;
        if (c < 0 || reserved[r]![c]) continue;
        const bit = finalBits[bitIdx++] ?? 0;
        m[r]![c] = (bit === 1) !== maskFn(r, c);
      }
    }
    goingUp = !goingUp;
  }

  writeFormat(m, 0, size);
  return m;
};

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

/** Minimal Code128-B encoder — enough to draw a scannable URL barcode offline. */
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
  "241112",
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

export interface Barcode {
  /** One entry per bar/space; `true` means a black bar. */
  modules: boolean[];
  checksum: number;
}

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
