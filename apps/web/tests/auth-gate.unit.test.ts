import { describe, expect, it } from "vitest";
import { readSessionToken, sessionToken } from "../src/server/auth";

const ID = "22222222-2222-4222-8222-222222222222";

describe("session token integrity", () => {
  it("round-trips a signed session id", () => {
    expect(readSessionToken(sessionToken(ID))).toBe(ID);
  });

  it("rejects malformed and tampered tokens", () => {
    expect(readSessionToken(undefined)).toBeNull();
    expect(readSessionToken("no-dot")).toBeNull();
    expect(readSessionToken(`${ID}.deadbeef`)).toBeNull();
  });

  it("does not accept the raw id without a signature", () => {
    expect(readSessionToken(ID)).toBeNull();
  });
});
