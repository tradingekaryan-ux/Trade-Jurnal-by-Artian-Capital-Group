import { expect, it } from "vitest";
import { encodeCode128B } from "../src/lib/barcode";

it("encodes a URL into a Code128-B module pattern", () => {
  const url = "https://artian.capital";
  const first = encodeCode128B(url);
  const second = encodeCode128B(url);
  expect(first.modules).toEqual(second.modules);
  expect(first.checksum).toBeGreaterThanOrEqual(0);
  expect(first.checksum).toBeLessThan(103);
  // Start-B (211214) + 20 data symbols + checksum + stop (2331112).
  expect(first.modules.length).toBeGreaterThan(200);
  expect(encodeCode128B("https://example.com").modules).not.toEqual(first.modules);
});
