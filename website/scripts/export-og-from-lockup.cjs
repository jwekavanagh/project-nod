"use strict";

const { readFileSync } = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

async function main() {
  const root = path.join(__dirname, "..");
  const svgPath = path.join(root, "public", "brand", "lockup.svg");
  const outPath = path.join(root, "public", "og.png");
  const svgBuf = readFileSync(svgPath);
  const mark = await sharp(svgBuf).resize(320, 320).png().toBuffer();
  const w = 1200;
  const h = 630;
  const left = Math.round((w - 320) / 2);
  const top = Math.round((h - 320) / 2);
  await sharp({
    create: {
      width: w,
      height: h,
      channels: 3,
      background: { r: 246, g: 248, b: 252 },
    },
  })
    .composite([{ input: mark, left, top }])
    .png()
    .toFile(outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
