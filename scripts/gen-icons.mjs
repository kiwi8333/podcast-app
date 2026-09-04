// Regenerates the PWA/home-screen PNGs from public/icons/icon-source.svg.
// Run with: node scripts/gen-icons.mjs   (needs the `sharp` devDependency)
import sharp from "sharp";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const iconsDir = fileURLToPath(new URL("../public/icons/", import.meta.url));
const source = readFileSync(path.join(iconsDir, "icon-source.svg"));

// 180 is the size iOS asks for via apple-touch-icon; 192/512 are the
// manifest entries. iOS masks the corners itself, so the source is a
// full-bleed square rather than a pre-rounded one.
// flatten drops the alpha channel: iOS paints any transparency in an
// apple-touch-icon as black rather than compositing it.
const OUTPUTS = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180, flatten: true },
];

for (const { file, size, flatten } of OUTPUTS) {
  let pipeline = sharp(source, { density: 512 }).resize(size, size);
  if (flatten) pipeline = pipeline.flatten({ background: "#0A84FF" });
  await pipeline.png().toFile(path.join(iconsDir, file));
  console.log(`wrote ${file} (${size}x${size})`);
}
