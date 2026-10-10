// Gera icon-180.png, icon-192.png e icon-512.png sem dependência (PNG puro com zlib).
// Uso: node tools/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

const TAB = new Uint32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; TAB[n] = c >>> 0; }
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = TAB[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(tipo, dados) {
  const len = Buffer.alloc(4); len.writeUInt32BE(dados.length);
  const td = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(n, pixel) {
  const linha = n * 4 + 1, raw = Buffer.alloc(linha * n);
  for (let y = 0; y < n; y++) {
    raw[y * linha] = 0;
    for (let x = 0; x < n; x++) {
      const [r, g, b, a] = pixel(x + 0.5, y + 0.5);
      const o = y * linha + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const cob = (d) => Math.max(0, Math.min(1, 0.5 - d)); // cobertura por distância assinada (antialias de 1 px)

// Fundo escuro, anel caramelo (a lente) e miolo creme.
function desenhar(n) {
  const c = n / 2, FUNDO = [11, 11, 12], ANEL = [201, 138, 60], MIOLO = [243, 240, 234];
  const rAnel = n * 0.33, esp = n * 0.075, rMiolo = n * 0.115;
  return (x, y) => {
    const d = Math.hypot(x - c, y - c);
    let cor = FUNDO;
    cor = mix(cor, ANEL, cob(Math.abs(d - rAnel) - esp / 2));
    cor = mix(cor, MIOLO, cob(d - rMiolo));
    return [cor[0], cor[1], cor[2], 255];
  };
}

for (const n of [180, 192, 512]) {
  writeFileSync(join(raiz, `icon-${n}.png`), png(n, desenhar(n)));
  console.log(`icon-${n}.png`);
}
