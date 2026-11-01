/**
 * Tiny static file server for local runs and the browser tests.
 *   node tests/serve.mjs          → http://localhost:4173  (from the repo root)
 *   npm start                     → the same, from tests/
 *   PORT=8080 node tests/serve.mjs
 * Missing paths get 404.html with a 404 status, like GitHub Pages.
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 4173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

async function send(response, filePath, status = 200) {
  const body = await readFile(filePath);
  response.writeHead(status, { 'content-type': TYPES[path.extname(filePath)] ?? 'application/octet-stream' });
  response.end(body);
}

http.createServer(async (request, response) => {
  let urlPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  if (urlPath.endsWith('/')) urlPath += 'index.html';

  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403).end();
    return;
  }

  try {
    await send(response, filePath);
  } catch {
    await send(response, path.join(ROOT, '404.html'), 404).catch(() => response.writeHead(404).end());
  }
}).listen(PORT, () => console.log(`Nano Motion on http://localhost:${PORT}`));
