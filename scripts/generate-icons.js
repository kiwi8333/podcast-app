const sharp = require("sharp");
const path = require("path");

const SRC = path.join(__dirname, "..", "public", "icons", "icon-source.svg");
const OUT_DIR = path.join(__dirname, "..", "public", "icons");

const targets = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

async function run() {
  for (const { name, size } of targets) {
    await sharp(SRC).resize(size, size).png().toFile(path.join(OUT_DIR, name));
    console.log(`Wrote ${name} (${size}x${size})`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
