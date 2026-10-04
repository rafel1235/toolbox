import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(fileURLToPath(new URL('../src/', import.meta.url)));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.json': 'application/json', '.bcmap': 'application/octet-stream', '.ttf': 'font/ttf', '.pfb': 'application/octet-stream' };
export function createServer() {
    return http.createServer(async (request, response) => {
        try {
            if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
            const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
            const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
            if (!file.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
            const bytes = await readFile(file);
            response.writeHead(200, {
                'Content-Type': types[path.extname(file)] || 'application/octet-stream',
                'X-Content-Type-Options': 'nosniff',
                'Referrer-Policy': 'no-referrer',
                'Content-Security-Policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; img-src 'self' blob: data:; connect-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
            });
            response.end(request.method === 'HEAD' ? undefined : bytes);
        } catch { response.writeHead(404); response.end('File non trovato'); }
    });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const port = Number(process.env.PORT || 4173);
    createServer().listen(port, '127.0.0.1', () => console.log(`PrivatePDF: http://127.0.0.1:${port}`));
}
