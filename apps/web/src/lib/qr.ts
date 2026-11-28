/**
 * QR encoder — port of Kazuhiko Arase's qrcode-generator (MIT license),
 * limited to byte mode, ECC level M, versions 1–10.
 * Source: https://github.com/kazuhikoarase/qrcode-generator
 */

const PAD0 = 0xec;
const PAD1 = 0x11;

type Matrix = boolean[][];

// ── QRMath ────────────────────────────────────────────────────────────────────
const EXP: number[] = new Array(256);
const LOG: number[] = new Array(256);
for (let i = 0; i < 8; i++) EXP[i] = 1 << i;
for (let i = 8; i < 256; i++) EXP[i] = EXP[i - 4]! ^ EXP[i - 5]! ^ EXP[i - 6]! ^ EXP[i - 8]!;
for (let i = 0; i < 255; i++) LOG[EXP[i]!] = i;

const glog = (n: number): number => {
  if (n < 1) throw new Error(`glog(${n})`);
  return LOG[n]!;
};
const gexp = (n: number): number => {
  while (n < 0) n += 255;
  while (n >= 256) n -= 255;
  return EXP[n]!;
};

// ── Polynomial ────────────────────────────────────────────────────────────────
class Poly {
  private readonly num: number[];

  constructor(num: number[], shift = 0) {
    let offset = 0;
    while (offset < num.length && num[offset] === 0) offset++;
    this.num = new Array(num.length - offset + shift).fill(0);
    for (let i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset]!;
  }

  getAt(i: number): number {
    return this.num[i]!;
  }
  getLength(): number {
    return this.num.length;
  }

  multiply(e: Poly): Poly {
    const out = new Array(this.getLength() + e.getLength() - 1).fill(0);
    for (let i = 0; i < this.getLength(); i++)
      for (let j = 0; j < e.getLength(); j++)
        out[i + j]! ^= gexp(glog(this.getAt(i)) + glog(e.getAt(j)));
    return new Poly(out);
  }

  mod(e: Poly): Poly {
    if (this.getLength() - e.getLength() < 0) return this;
    const ratio = glog(this.getAt(0)) - glog(e.getAt(0));
    const num = this.num.slice();
    for (let i = 0; i < e.getLength(); i++) num[i]! ^= gexp(glog(e.getAt(i)) + ratio);
    return new Poly(num).mod(e);
  }
}

const ecPolynomial = (length: number): Poly => {
  let a = new Poly([1]);
  for (let i = 0; i < length; i++) a = a.multiply(new Poly([1, gexp(i)]));
  return a;
};

// ── RS block table (ECC M only, versions 1–10) ───────────────────────────────
// Each entry: [count, totalCodewords, dataCodewords, ...]
const RS_BLOCKS: number[][] = [
  [1, 26, 16],
  [1, 44, 28],
  [1, 70, 44],
  [2, 50, 32],
  [2, 67, 43],
  [4, 43, 27],
  [4, 49, 31],
  [2, 60, 38, 2, 61, 39],
  [3, 58, 36, 2, 59, 37],
  [4, 69, 43, 1, 70, 44],
];

interface RsBlock {
  total: number;
  data: number;
}
const rsBlocks = (ver: number): RsBlock[] => {
  const table = RS_BLOCKS[ver - 1]!;
  const list: RsBlock[] = [];
  for (let i = 0; i < table.length; i += 3) {
    const count = table[i]!;
    for (let j = 0; j < count; j++) list.push({ total: table[i + 1]!, data: table[i + 2]! });
  }
  return list;
};

// ── BCH / masks ───────────────────────────────────────────────────────────────
const G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | 1;
const G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);
const bchDigit = (data: number): number => {
  let d = 0;
  while (data !== 0) {
    d++;
    data >>>= 1;
  }
  return d;
};
const bchTypeInfo = (data: number): number => {
  let d = data << 10;
  while (bchDigit(d) - bchDigit(G15) >= 0) d ^= G15 << (bchDigit(d) - bchDigit(G15));
  return ((data << 10) | d) ^ G15_MASK;
};

const PATTERN_POS: number[][] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

const maskFn = (pattern: number, i: number, j: number): boolean => {
  switch (pattern) {
    case 0:
      return (i + j) % 2 === 0;
    case 1:
      return i % 2 === 0;
    case 2:
      return j % 3 === 0;
    case 3:
      return (i + j) % 3 === 0;
    case 4:
      return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
    case 5:
      return ((i * j) % 2) + ((i * j) % 3) === 0;
    case 6:
      return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0;
    case 7:
      return (((i * j) % 3) + ((i + j) % 2)) % 2 === 0;
    default:
      throw new Error(`bad mask ${pattern}`);
  }
};

// ── Bit buffer ────────────────────────────────────────────────────────────────
class BitBuffer {
  private buf: number[] = [];
  private len = 0;

  put(num: number, length: number): void {
    for (let i = 0; i < length; i++) this.putBit(((num >>> (length - i - 1)) & 1) === 1);
  }
  putBit(bit: boolean): void {
    const idx = Math.floor(this.len / 8);
    if (this.buf.length <= idx) this.buf.push(0);
    if (bit) this.buf[idx]! |= 0x80 >>> (this.len % 8);
    this.len++;
  }
  getBuffer(): number[] {
    return this.buf;
  }
  getLength(): number {
    return this.len;
  }
}

// ── Data creation ─────────────────────────────────────────────────────────────
const createBytes = (buffer: number[], blocks: RsBlock[]): number[] => {
  let offset = 0;
  let maxDc = 0;
  let maxEc = 0;
  const dcdata: number[][] = [];
  const ecdata: number[][] = [];

  for (const block of blocks) {
    const dcCount = block.data;
    const ecCount = block.total - dcCount;
    maxDc = Math.max(maxDc, dcCount);
    maxEc = Math.max(maxEc, ecCount);
    const dc = buffer.slice(offset, offset + dcCount);
    offset += dcCount;
    dcdata.push(dc);
    const rsPoly = ecPolynomial(ecCount);
    const raw = new Poly(dc, rsPoly.getLength() - 1);
    const mod = raw.mod(rsPoly);
    const ec: number[] = new Array(rsPoly.getLength() - 1).fill(0);
    for (let i = 0; i < ec.length; i++) {
      const idx = i + mod.getLength() - ec.length;
      ec[i] = idx >= 0 ? mod.getAt(idx) : 0;
    }
    ecdata.push(ec);
  }

  const total = blocks.reduce((sum, b) => sum + b.total, 0);
  const out: number[] = new Array(total);
  let index = 0;
  for (let i = 0; i < maxDc; i++)
    for (let r = 0; r < blocks.length; r++)
      if (i < dcdata[r]!.length) out[index++] = dcdata[r]![i]!;
  for (let i = 0; i < maxEc; i++)
    for (let r = 0; r < blocks.length; r++)
      if (i < ecdata[r]!.length) out[index++] = ecdata[r]![i]!;
  return out;
};

const createData = (ver: number, bytes: Uint8Array): number[] => {
  const blocks = rsBlocks(ver);
  const buf = new BitBuffer();
  buf.put(0b0100, 4); // byte mode
  buf.put(bytes.length, 8); // v1–9 count bits
  bytes.forEach((b) => buf.put(b, 8));

  const totalDataCount = blocks.reduce((sum, b) => sum + b.data, 0);
  if (buf.getLength() > totalDataCount * 8) throw new Error("QR code length overflow.");

  if (buf.getLength() + 4 <= totalDataCount * 8) buf.put(0, 4);
  while (buf.getLength() % 8 !== 0) buf.putBit(false);
  while (true) {
    if (buf.getLength() >= totalDataCount * 8) break;
    buf.put(PAD0, 8);
    if (buf.getLength() >= totalDataCount * 8) break;
    buf.put(PAD1, 8);
  }
  return createBytes(buf.getBuffer(), blocks);
};

// ── Matrix construction ───────────────────────────────────────────────────────
const lostPoint = (m: Matrix): number => {
  const n = m.length;
  let lost = 0;
  for (let row = 0; row < n; row++)
    for (let col = 0; col < n; col++) {
      let same = 0;
      const dark = m[row]![col]!;
      for (let r = -1; r <= 1; r++)
        for (let c = -1; c <= 1; c++) {
          if (r === 0 && c === 0) continue;
          if (row + r < 0 || n <= row + r || col + c < 0 || n <= col + c) continue;
          if (dark === m[row + r]![col + c]) same++;
        }
      if (same > 5) lost += 3 + same - 5;
    }
  for (let row = 0; row < n - 1; row++)
    for (let col = 0; col < n - 1; col++) {
      const c =
        (m[row]![col] ? 1 : 0) +
        (m[row + 1]![col] ? 1 : 0) +
        (m[row]![col + 1] ? 1 : 0) +
        (m[row + 1]![col + 1] ? 1 : 0);
      if (c === 0 || c === 4) lost += 3;
    }
  let darkCount = 0;
  for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) if (m[row]![col]) darkCount++;
  lost += (Math.abs((100 * darkCount) / n / n - 50) / 5) * 10;
  return lost;
};

const makeMatrix = (ver: number, data: number[], mask: number): Matrix => {
  const size = ver * 4 + 17;
  const m: Matrix = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const placed: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );

  const set = (r: number, c: number, v: boolean): void => {
    if (r < 0 || r >= size || c < 0 || c >= size) return;
    m[r]![c] = v;
    placed[r]![c] = true;
  };

  // Finder patterns
  const finders: Array<[number, number]> = [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ];
  for (const [row, col] of finders) {
    for (let r = -1; r <= 7; r++)
      for (let c = -1; c <= 7; c++) {
        const dark =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        set(row + r, col + c, dark);
      }
  }

  // Alignment patterns
  const pos = PATTERN_POS[ver - 1]!;
  for (const row of pos)
    for (const col of pos) {
      if (placed[row]![col]) continue;
      for (let r = -2; r <= 2; r++)
        for (let c = -2; c <= 2; c++)
          set(row + r, col + c, Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0));
    }

  // Timing patterns
  for (let r = 8; r < size - 8; r++) if (!placed[r]![6]) set(r, 6, r % 2 === 0);
  for (let c = 8; c < size - 8; c++) if (!placed[6]![c]) set(6, c, c % 2 === 0);

  // Format info
  const bits = bchTypeInfo(mask); // ECC M format bits = 0
  for (let i = 0; i < 15; i++) {
    const mod = ((bits >> i) & 1) === 1;
    if (i < 6) set(i, 8, mod);
    else if (i < 8) set(i + 1, 8, mod);
    else set(size - 15 + i, 8, mod);
  }
  for (let i = 0; i < 15; i++) {
    const mod = ((bits >> i) & 1) === 1;
    if (i < 8) set(8, size - i - 1, mod);
    else if (i < 9) set(8, 15 - i - 1 + 1, mod);
    else set(8, 15 - i - 1, mod);
  }
  set(size - 8, 8, true);

  // Version info (version >= 7)
  if (ver >= 7) {
    const G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | 1;
    let rem = ver << 12;
    while (bchDigit(rem) - bchDigit(G18) >= 0) rem ^= G18 << (bchDigit(rem) - bchDigit(G18));
    const vbits = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const mod = ((vbits >> i) & 1) === 1;
      set(Math.floor(i / 3), (i % 3) + size - 8 - 3, mod);
      set((i % 3) + size - 8 - 3, Math.floor(i / 3), mod);
    }
  }

  // Data placement
  let inc = -1;
  let row = size - 1;
  let bitIndex = 7;
  let byteIndex = 0;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    while (true) {
      for (let c = 0; c < 2; c++) {
        if (placed[row]![col - c]) continue;
        let dark = false;
        if (byteIndex < data.length) dark = ((data[byteIndex]! >>> bitIndex) & 1) === 1;
        if (maskFn(mask, row, col - c)) dark = !dark;
        m[row]![col - c] = dark;
        bitIndex--;
        if (bitIndex === -1) {
          byteIndex++;
          bitIndex = 7;
        }
      }
      row += inc;
      if (row < 0 || size <= row) {
        row -= inc;
        inc = -inc;
        break;
      }
    }
  }
  return m;
};

/** Encode text into a QR matrix (byte mode, ECC M). */
export const encodeQr = (text: string): Matrix | null => {
  const bytes = new TextEncoder().encode(text.slice(0, 120));
  let ver = 0;
  for (let v = 1; v <= 10; v++) {
    const totalData = rsBlocks(v).reduce((sum, b) => sum + b.data, 0);
    if (4 + 8 + bytes.length * 8 <= totalData * 8) {
      ver = v;
      break;
    }
  }
  if (!ver) return null;

  const data = createData(ver, bytes);
  let best = makeMatrix(ver, data, 0);
  let bestLost = lostPoint(best);
  for (let mask = 1; mask < 8; mask++) {
    const candidate = makeMatrix(ver, data, mask);
    const lost = lostPoint(candidate);
    if (lost < bestLost) {
      best = candidate;
      bestLost = lost;
    }
  }
  return best;
};
