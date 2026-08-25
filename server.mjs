// Daddy AI - Node.js server entry point
// Wraps the TanStack Start handler into a proper HTTP server
import { createServer } from 'http';
import * as handler from './dist/server/server.js';

const port = process.env.PORT || 3000;

function collectBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
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
