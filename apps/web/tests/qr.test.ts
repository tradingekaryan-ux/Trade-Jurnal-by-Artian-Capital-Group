import { expect, it } from "vitest";
import { encodeQr } from "../src/lib/qr";

const SHARE_URL = "https://artiancapitalgroup.vercel.app";

it("encodes the share URL into a square QR matrix", () => {
  const matrix = encodeQr(SHARE_URL);
  expect(matrix).not.toBeNull();
  expect(matrix!.length).toBe(matrix![0]!.length);
  expect(matrix!.length).toBeGreaterThan(20);
});

it("produces the same matrix for the same URL and a different one for a different URL", () => {
  const first = encodeQr(SHARE_URL);
  const second = encodeQr(SHARE_URL);
  const other = encodeQr("https://example.com");
  expect(first).toEqual(second);
  expect(other).not.toEqual(first);
});
