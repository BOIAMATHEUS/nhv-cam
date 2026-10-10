// Servidor estático local para testar: node tools/servir.mjs [porta]
import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const porta = Number(process.argv[2]) || 8787;
const tipos = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.md': 'text/markdown; charset=utf-8', '.json': 'application/json',
};

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = normalize(join(raiz, p));
  if (!f.startsWith(raiz)) { res.writeHead(403); return res.end(); }
  try {
    const st = statSync(f);
    if (!st.isFile()) throw new Error('não é arquivo');
    res.writeHead(200, { 'content-type': tipos[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(f).pipe(res);
  } catch (e) { res.writeHead(404); res.end('404'); }
}).listen(porta, '127.0.0.1', () => console.log('servindo', raiz, 'em http://localhost:' + porta + '/'));
