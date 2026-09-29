import { mkdir, copyFile, readdir } from 'node:fs/promises';
import path from 'node:path';
// Allowlist only public files. SQL, source scripts, docs and secrets stay out.
await mkdir('dist', { recursive: true });
for (const file of await readdir('.')) {
  if (/^[a-z-]+\.html$/.test(file)) await copyFile(file, path.join('dist', file));
}
async function copyAssets(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const source = path.join(dir, entry.name);
    if (entry.isDirectory()) await copyAssets(source);
    else if (/\.(css|js|webp|jpg|png|svg|pdf)$/.test(entry.name)) {
      await mkdir(path.dirname(path.join('dist', source)), { recursive: true });
      await copyFile(source, path.join('dist', source));
    }
  }
}
await copyAssets('assets');
