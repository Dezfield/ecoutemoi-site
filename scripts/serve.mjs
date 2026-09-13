import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('dist');
const base = process.env.SITE_BASE || '/';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain', '.xml': 'application/xml' };
createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (!path.startsWith(base)) throw new Error('Not found');
    let file = resolve(root, path.slice(base.length) || '.');
    if (file !== root && !file.startsWith(root + sep)) throw new Error('Not found');
    if ((await stat(file)).isDirectory()) {
      if (!path.endsWith('/')) { res.writeHead(301, { Location: `${path}/${new URL(req.url, 'http://localhost').search}` }); res.end(); return; }
      file = resolve(file, 'index.html');
    }
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' }); res.end(await readFile(file));
  } catch { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(await readFile(resolve(root, '404.html'))); }
}).listen(4173, '127.0.0.1', () => console.log(`Local static preview: http://127.0.0.1:4173${base}`));
