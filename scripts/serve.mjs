// Local preview: serves app/ with /vendor/three/ from node_modules.
// npm run dev  ->  http://localhost:4400
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const port = Number(process.env.PORT) || 4400;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

http.createServer((req, res) => {
  let url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (url.endsWith('/')) url += 'index.html';
  const file = url.startsWith('/vendor/three/')
    ? path.join(root, 'node_modules', 'three', url.slice('/vendor/three/'.length))
    : path.join(root, 'app', url);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  });
}).listen(port, () => console.log(`http://localhost:${port}`));
