// Writes placeholder PWA icons into public/. Run once by hand: node scripts/make-icons.mjs
// Replace the three PNGs with real artwork whenever you like; the manifest only needs the file names.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const BG = [0x29, 0x25, 0x24]; // stone-800
const FG = [0xfa, 0xfa, 0xf9]; // stone-50

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

// Distance from point p to segment a-b.
function distance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// A "V" inside the middle 50% of the square, so it also survives the maskable crop.
function png(size) {
  const raw = Buffer.alloc(size * (1 + size * 3));
  const half = 0.045 * size;
  const [x1, x2, xm] = [0.25 * size, 0.75 * size, 0.5 * size];
  const [yTop, yBottom] = [0.28 * size, 0.72 * size];
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 3);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const d = Math.min(distance(x + 0.5, y + 0.5, x1, yTop, xm, yBottom), distance(x + 0.5, y + 0.5, x2, yTop, xm, yBottom));
      const cover = Math.max(0, Math.min(1, half + 0.5 - d));
      for (let c = 0; c < 3; c++) raw[row + 1 + x * 3 + c] = Math.round(BG[c] + (FG[c] - BG[c]) * cover);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // color type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public', { recursive: true });
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512]]) {
  writeFileSync(`public/${name}`, png(size));
  console.log(`public/${name}`);
}
