// Local-only fictional fixtures. Never use this server for production.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
export const validCode = 'demo_valid_0123456789abcdef0123456789';
export const revokedCode = 'demo_revoked_0123456789abcdef01234567';
const fixture = { number: 'DEMO-000001', name: 'Fictional Learner', course: 'Graphic Design — TEST ONLY', date: '2026-09-28' };
export function createPreviewServer() {
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/verify-certificate') {
      res.setHeader('Content-Type', 'application/json');
      if (req.method !== 'POST') { res.writeHead(405).end('{}'); return; }
      let body = '';
      try {
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 1024) { res.writeHead(413).end('{}'); return; }
        }
        const { code } = JSON.parse(body);
        if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{24,128}$/.test(code)) { res.writeHead(400).end('{}'); return; }
        const status = code === validCode ? 'valid' : code === revokedCode ? 'revoked' : 'not_found';
        res.end(JSON.stringify({ demo: true, status, ...(status === 'valid' ? { certificate: fixture } : {}) }));
      } catch { res.writeHead(400).end('{}'); }
      return;
    }
    // Explicit public-file allowlist; never expose scripts, docs, or Git files.
    const relative = url.pathname.slice(1) || 'verify.html';
    if (!/^(?:[a-z-]+\.html|assets\/[a-z0-9_./-]+\.(?:css|js|webp|jpg|png|svg))$/.test(relative) || relative.includes('..')) {
      res.writeHead(404).end('Not found'); return;
    }
    try {
      const data = await readFile(path.join(root, relative));
      const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
      res.setHeader('Content-Type', types[path.extname(relative)]);
      res.end(data);
    } catch { res.writeHead(404).end('Not found'); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createPreviewServer().listen(8001, '127.0.0.1', () => console.log('Local fictional preview: http://127.0.0.1:8001/verify.html'));
}
