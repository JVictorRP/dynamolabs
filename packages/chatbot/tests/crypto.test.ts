import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "../src/crypto";

const key = randomBytes(32).toString("base64");

describe("crypto", () => {
  it("round-trips a token", () => {
    const enc = encrypt("EAAG-token-secreto", key);
    expect(enc.startsWith("v1.")).toBe(true);
    expect(enc).not.toContain("EAAG");
    expect(decrypt(enc, key)).toBe("EAAG-token-secreto");
  });
  it("rejects a tampered token", () => {
    const enc = encrypt("abc", key);
    const parts = enc.split(".");
    parts[3] = Buffer.from("xyz").toString("base64url");
    expect(() => decrypt(parts.join("."), key)).toThrow();
  });
  it("rejects the wrong key", () => {
    const enc = encrypt("abc", key);
    expect(() => decrypt(enc, randomBytes(32).toString("base64"))).toThrow();
  });
  it("refuses a key that is not 32 bytes", () => {
    expect(() => encrypt("abc", Buffer.from("curta").toString("base64"))).toThrow(/32 bytes/);
  });
});
