// Local static preview of the built web app with SPA fallback.
// Development utility only: bound to 127.0.0.1, never an internet server.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.env.APP_DIST || 'dist');
const port = Number(process.env.APP_PORT || 4174);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json',
};
const headers = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
};

export function startServer(listenPort = port, distRoot = root) {
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let file = resolve(distRoot, `.${pathname}`);
      if (file !== distRoot && !file.startsWith(distRoot + sep)) throw new Error('outside root');
      const info = await stat(file).catch(() => null);
      // Unknown paths without a file extension are client-side routes.
      if (!info || info.isDirectory()) {
        if (extname(pathname)) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
          res.end('Not found');
          return;
        }
        file = resolve(distRoot, 'index.html');
      }
      const cache = file.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache';
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': cache, ...headers });
      res.end(await readFile(file));
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
      res.end('Bad request');
    }
  });
  return new Promise((resolveServer) => {
    server.listen(listenPort, '127.0.0.1', () => resolveServer(server));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startServer();
  console.log(`Local app preview: http://127.0.0.1:${port}/`);
}
