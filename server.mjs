// Daddy AI - Node.js server entry point
// Wraps the TanStack Start handler into a proper HTTP server
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import * as handler from './dist/server/server.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CLIENT_DIR = join(__dirname, 'dist', 'client');
const port = process.env.PORT || 3000;

const MIME_TYPES = {
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
};

function collectBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

async function serveStaticFile(path, res) {
  try {
    const filePath = join(CLIENT_DIR, path);
    const data = await readFile(filePath);
    const ext = extname(filePath);
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': ext === '.css' || ext === '.js' ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
    });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // Serve static assets from dist/client
    if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/favicon')) {
      const served = await serveStaticFile(url.pathname, res);
      if (served) return;
    }

    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers[key] = Array.isArray(value) ? value.join(', ') : value;
    }
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await collectBody(req);
    const request = new Request(url.toString(), {
      method: req.method,
      headers,
      body,
    });
    const serverHandler = handler.default ?? handler;
    const fetchFn = serverHandler.fetch ?? serverHandler.default?.fetch;
    const response = await fetchFn.call(serverHandler, request, process.env, {});
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (err) {
    console.error('Server error:', err);
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Daddy AI listening on http://localhost:${port}/`);
});
