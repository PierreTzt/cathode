// Génère les icônes PWA (PNG RGBA) sans aucune dépendance : encodage PNG maison
// via zlib intégré. Design « cinéma sombre » : fond #0b0d10, disque doré, triangle
// « play » sombre. Sorties : public/icon-192.png, icon-512.png, apple-touch-icon.png (180).
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
mkdirSync(OUT, { recursive: true });

const BG = [11, 13, 16, 255]; // #0b0d10
const GOLD = [200, 178, 115, 255]; // #c8b273

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function pngRGBA(n, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0);
  ihdr.writeUInt32BE(n, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // 10,11,12 = 0 (compression, filter, interlace)
  const raw = Buffer.alloc(n * (n * 4 + 1));
  for (let y = 0; y < n; y++) {
    raw[y * (n * 4 + 1)] = 0; // filter none
    for (let x = 0; x < n; x++) {
      const src = (y * n + x) * 4;
      const dst = y * (n * 4 + 1) + 1 + x * 4;
      raw[dst] = pixels[src];
      raw[dst + 1] = pixels[src + 1];
      raw[dst + 2] = pixels[src + 2];
      raw[dst + 3] = pixels[src + 3];
    }
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function render(n) {
  const px = new Uint8Array(n * n * 4);
  const cx = n / 2;
  const cy = n / 2;
  const rDisk = n * 0.38;
  // triangle « play » : pointe à droite, centré (légèrement décalé pour l'équilibre optique)
  const t = n * 0.17;
  const ax = cx - t * 0.85;
  const ay1 = cy - t;
  const ay2 = cy + t;
  const bx = cx + t * 1.15;
  const by = cy;
  const sign = (px1, py1, px2, py2, px3, py3) =>
    (px1 - px3) * (py2 - py3) - (px2 - px3) * (py1 - py3);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let col = BG;
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= rDisk * rDisk) col = GOLD;
      // triangle sombre par-dessus le disque
      const d1 = sign(x, y, ax, ay1, ax, ay2);
      const d2 = sign(x, y, ax, ay2, bx, by);
      const d3 = sign(x, y, bx, by, ax, ay1);
      const dansTri = !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
      if (dansTri && col === GOLD) col = BG;
      const i = (y * n + x) * 4;
      px[i] = col[0];
      px[i + 1] = col[1];
      px[i + 2] = col[2];
      px[i + 3] = col[3];
    }
  }
  return px;
}

for (const [n, name] of [
  [192, "icon-192.png"],
  [512, "icon-512.png"],
  [180, "apple-touch-icon.png"],
]) {
  writeFileSync(join(OUT, name), pngRGBA(n, render(n)));
  console.log(`écrit public/${name} (${n}×${n})`);
}
