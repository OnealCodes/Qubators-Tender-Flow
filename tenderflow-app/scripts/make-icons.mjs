// Generates TenderFlow PWA icons with zero dependencies (raw RGBA -> PNG).
// Navy rounded square, gold "T" drawn with rectangles (matches shell logo).
// Usage: node scripts/make-icons.mjs  (writes public/icons/*.png)
// Deterministic: same bytes on every run.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

const NAVY = [10, 44, 78, 255];
const GOLD = [245, 179, 1, 255];

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(w, h, rgba) {
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0; // filter: none
    Buffer.from(rgba.subarray(y * w * 4, (y + 1) * w * 4)).copy(raw, y * (1 + w * 4) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

// Draws the icon. maskable=true keeps art inside the 80% safe zone.
function draw(size, maskable) {
  const px = new Uint8Array(size * size * 4);
  const put = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    px.set(c, (y * size + x) * 4);
  };
  const r = maskable ? 0 : Math.round(size * 0.22); // maskable: full bleed
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.min(x, size - 1 - x);
      const dy = Math.min(y, size - 1 - y);
      if (dx >= 0 && dy >= 0 && (r === 0 || dx + dy >= r * 0.6 || Math.min(dx, dy) >= 0)) {
        // rounded-corner mask (skip corner pixels outside radius)
        const cx = Math.min(x, size - 1 - x);
        const cy = Math.min(y, size - 1 - y);
        if (r > 0 && cx < r && cy < r && (r - cx) ** 2 + (r - cy) ** 2 > r * r) continue;
        put(x, y, NAVY);
      }
    }
  }
  // Gold "T": top bar + stem, sized to the safe zone.
  const m = maskable ? 0.1 : 0.2; // margin
  const x0 = Math.round(size * m);
  const x1 = Math.round(size * (1 - m));
  const barH = Math.round(size * 0.16);
  const stemW = Math.round(size * 0.18);
  const yT = Math.round(size * (maskable ? 0.24 : 0.26));
  const cx0 = Math.round((size - stemW) / 2);
  for (let y = yT; y < yT + barH; y++) for (let x = x0; x < x1; x++) put(x, y, GOLD);
  for (let y = yT; y < Math.round(size * (maskable ? 0.76 : 0.74)); y++)
    for (let x = cx0; x < cx0 + stemW; x++) put(x, y, GOLD);
  return px;
}

fs.mkdirSync(root, { recursive: true });
const targets = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, false],
];
for (const [name, size, maskable] of targets) {
  const buf = png(size, size, draw(size, maskable));
  fs.writeFileSync(path.join(root, name), buf);
  console.log(`${name} ${buf.length} bytes sha=${createHash("sha256").update(buf).digest("hex").slice(0, 12)}`);
}
