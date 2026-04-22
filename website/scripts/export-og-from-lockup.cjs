"use strict";

const path = require("node:path");
const sharp = require("sharp");

/** Build 1200×630 OG image: mark (PNG) + two-line wordmark SVG overlay. */
async function main() {
  const root = path.join(__dirname, "..");
  const markPath = path.join(root, "public", "brand", "mark.png");
  const outPath = path.join(root, "public", "og.png");
  const w = 1200;
  const h = 630;
  const markSize = 300;
  const markLeft = 96;
  const markTop = Math.round((h - markSize) / 2);
  const mark = await sharp(markPath)
    .resize(markSize, markSize, { fit: "contain", background: { r: 246, g: 248, b: 252, alpha: 0 } })
    .png()
    .toBuffer();

  const textLeft = markLeft + markSize + 56;
  const textTop = 196;
  const textSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${w - textLeft - 64}" height="240" xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="56" font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="56" font-weight="700" letter-spacing="-0.02em">
    <tspan fill="#0b1f33">Agent</tspan><tspan fill="#00c853">Skeptic</tspan>
  </text>
  <text x="0" y="104" font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="15" font-weight="600" letter-spacing="0.14em" fill="#0b1f33">TRUST REALITY, NOT TRACES.</text>
</svg>`;
  const textPng = await sharp(Buffer.from(textSvg)).png().toBuffer();

  await sharp({
    create: {
      width: w,
      height: h,
      channels: 3,
      background: { r: 246, g: 248, b: 252 },
    },
  })
    .composite([
      { input: mark, left: markLeft, top: markTop },
      { input: textPng, left: textLeft, top: textTop },
    ])
    .png()
    .toFile(outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
