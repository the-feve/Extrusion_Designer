// Static build for Cloudflare Pages: copy app/ to dist/ and the three.js
// files the page imports to dist/vendor/three/. No bundler, no server code.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(path.join(root, 'app'), dist, {
  recursive: true,
  filter: (src) => !src.includes(`${path.sep}data${path.sep}geometry`), // local-only reference data
});
const three = path.join(root, 'node_modules', 'three');
const files = ['build/three.module.js', 'build/three.core.js', 'examples/jsm/controls/OrbitControls.js', 'LICENSE'];
for (const f of files) {
  const to = path.join(dist, 'vendor', 'three', f);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(path.join(three, f), to);
}
let bytes = 0;
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else bytes += fs.statSync(p).size; } };
walk(dist);
console.log(`dist/ ready (${(bytes / 1024).toFixed(0)} KB)`);
