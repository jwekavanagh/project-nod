import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Update in the same commit as `website/public/brand/lockup.svg` changes. */
const LOCKUP_SVG_SHA256 = "b9c6abd97b2656d82dae66e9f4781ed350aadad297f8048f80ba52c44d2d82db";

/** Update in the same commit as `website/public/og.png` changes. */
const OG_PNG_SHA256 = "f2e3c87361b1ecc91c4429205e4d088eb7bed6c96a26830d4503d01da28a4d39";

function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function readPngIhdrDimensions(buf: Buffer): { width: number; height: number } {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) {
    throw new Error("not a PNG");
  }
  if (buf.readUInt32BE(12) !== 0x49484452) {
    throw new Error("missing IHDR");
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe("rebrand assets (pinned bytes)", () => {
  const webRoot = path.join(__dirname, "..");
  const lockupPath = path.join(webRoot, "public", "brand", "lockup.svg");
  const ogPath = path.join(webRoot, "public", "og.png");

  it("lockup.svg SHA-256 matches pin", () => {
    const buf = readFileSync(lockupPath);
    expect(sha256Hex(buf)).toBe(LOCKUP_SVG_SHA256);
  });

  it("og.png SHA-256 matches pin and IHDR is 1200×630", () => {
    const buf = readFileSync(ogPath);
    expect(sha256Hex(buf)).toBe(OG_PNG_SHA256);
    const { width, height } = readPngIhdrDimensions(buf);
    expect(width).toBe(1200);
    expect(height).toBe(630);
  });

  it("lockup.svg encodes canonical navy and signal green", () => {
    const text = readFileSync(lockupPath, "utf8").toLowerCase();
    expect(text).toContain("#0b1f33");
    expect(text).toContain("#00c853");
  });
});
