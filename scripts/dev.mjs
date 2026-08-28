import { createReadStream, existsSync, statSync, watch } from 'node:fs';
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
const port = Number(process.env.PORT || 4173);

function build() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'scripts', 'build.mjs')], { stdio: 'inherit' });
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`Build failed: ${code}`)));
  });
}

await build();
let building = false;
watch(path.join(root, 'src'), { recursive: true }, async () => {
  if (building) return;
  building = true;
  try { await build(); } catch (error) { console.error(error.message); }
  building = false;
});

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png' };
const server = http.createServer((request, response) => {
  const urlPath = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  let file = path.join(output, urlPath);
  if (!path.extname(file)) file = path.join(file, 'index.html');
  if (!existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Nicht gefunden');
    return;
  }
  response.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(response);
});
server.listen(port, '127.0.0.1', () => console.log(`Local URL: http://127.0.0.1:${port}/de/`));
