import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Update in the same commit as `website/public/brand/mark.png` changes. */
const MARK_PNG_SHA256 = "ce39de4b85df9f6cbc76e7cb43e435d57332eac4387538f7f7a32956bc79a47c";

/** Update in the same commit as `website/public/og.png` changes. */
const OG_PNG_SHA256 = "e4471153e2bb07dac6f84ed363a8299bc5c31b80b0b81f50fd76d3c1675aa51e";

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
  const markPath = path.join(webRoot, "public", "brand", "mark.png");
  const ogPath = path.join(webRoot, "public", "og.png");

  it("mark.png SHA-256 matches pin and IHDR is square", () => {
    const buf = readFileSync(markPath);
    expect(sha256Hex(buf)).toBe(MARK_PNG_SHA256);
    const { width, height } = readPngIhdrDimensions(buf);
    expect(width).toBe(height);
    expect(width).toBeGreaterThanOrEqual(32);
  });

  it("og.png SHA-256 matches pin and IHDR is 1200×630", () => {
    const buf = readFileSync(ogPath);
    expect(sha256Hex(buf)).toBe(OG_PNG_SHA256);
    const { width, height } = readPngIhdrDimensions(buf);
    expect(width).toBe(1200);
    expect(height).toBe(630);
  });
});
